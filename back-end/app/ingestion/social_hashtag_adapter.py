"""
Social Media Hashtag Ingestion Adapter for SIH26069.

Collects weather-related posts tagged with #IMD and other relevant hashtags
from public social media APIs. Implements the PS requirement:
"automatically collect weather related posts and information tagged with #IMD
and other relevant weather hashtags, along with metadata such as date & time,
city, state, GPS location, photos, videos, and event category"
"""

import asyncio
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings
from app.ingestion.base import BaseIngestionAdapter
from app.ingestion.exceptions import AdapterFetchError
from app.ingestion.schemas import NormalizedEvidenceEvent, RawIngestionEvent

logger = logging.getLogger(__name__)


class SocialHashtagAdapter(BaseIngestionAdapter):
    """
    Ingestion adapter for weather-related social media posts via hashtag search.

    Targets: #IMD, #weather, #flood, #cyclone, #heatwave, #monsoon, etc.
    Extracts metadata: date/time, location (city, state, GPS), photos, videos, event category.
    """

    # Weather hashtag categories mapped to hazard types
    HASHTAG_CATEGORY_MAP: Dict[str, str] = {
        "imd": "OFFICIAL_ALERT",
        "weather": "GENERAL_WEATHER",
        "flood": "FLOODING",
        "flooding": "FLOODING",
        "waterlogging": "FLOODING",
        "inundation": "FLOODING",
        "cyclone": "CYCLONE",
        "cyclonealert": "CYCLONE",
        "storm": "STORM",
        "thunderstorm": "THUNDERSTORM",
        "lightning": "THUNDERSTORM",
        "heatwave": "HEATWAVE",
        "heat": "HEATWAVE",
        "monsoon": "HEAVY_RAINFALL",
        "rain": "HEAVY_RAINFALL",
        "heavyrain": "HEAVY_RAINFALL",
        "downpour": "HEAVY_RAINFALL",
        "cloudburst": "HEAVY_RAINFALL",
        "landslide": "LANDSLIDE",
        "mudslide": "LANDSLIDE",
        "drought": "DROUGHT",
        "fog": "FOG",
        "duststorm": "DUST_STORM",
        "dust": "DUST_STORM",
        "hail": "HAILSTORM",
        "hailstorm": "HAILSTORM",
        "strongwind": "STRONG_WINDS",
        "gale": "STRONG_WINDS",
    }

    def __init__(
        self,
        source_code: str = "SOCIAL_HASHTAG",
        source_name: str = "Social Media Weather Hashtags",
        api_endpoint: Optional[str] = None,
        api_key: Optional[str] = None,
        hashtags: Optional[List[str]] = None,
        max_results: int = 100,
        timeout_seconds: float = 15.0,
        custom_client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        super().__init__(
            source_code=source_code,
            source_name=source_name,
            source_type="SOCIAL",
            base_trust_score=0.40,  # Social media is lower trust by default
        )
        self.api_endpoint = api_endpoint or getattr(settings, "SOCIAL_API_ENDPOINT", "https://api.social.example.com")
        self.api_key = api_key or getattr(settings, "SOCIAL_API_KEY", "")
        self.hashtags = hashtags or getattr(settings, "SOCIAL_HASHTAGS", [
            "imd", "weather", "flood", "flooding", "waterlogging",
            "cyclone", "storm", "thunderstorm", "lightning",
            "heatwave", "heat", "monsoon", "rain", "heavyrain",
            "cloudburst", "landslide", "drought", "fog",
            "duststorm", "hail", "hailstorm", "strongwind", "gale"
        ])
        self.max_results = max_results
        self.timeout_seconds = timeout_seconds
        self._custom_client = custom_client

    def _build_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/json",
            "User-Agent": "NationalWeatherPlatform-SIH26069/1.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    @classmethod
    def categorize_from_hashtags(cls, hashtags: List[str]) -> str:
        """Map hashtags to hazard category code."""
        for tag in hashtags:
            clean_tag = tag.lstrip("#").lower()
            if clean_tag in cls.HASHTAG_CATEGORY_MAP:
                return cls.HASHTAG_CATEGORY_MAP[clean_tag]
        return "OTHER"

    @classmethod
    def extract_location(cls, text: str) -> Dict[str, Optional[str]]:
        """Extract location mentions from text (city, state, GPS coordinates)."""
        # Simple regex patterns for Indian cities/states and GPS coords
        location_patterns = {
            "gps": re.compile(r'(-?\d{1,2}\.\d{3,6}),\s*(-?\d{1,3}\.\d{3,6})'),
            "cities": re.compile(
                r'\b(Mumbai|Delhi|Bangalore|Bengaluru|Chennai|Kolkata|Hyderabad|'
                r'Pune|Ahmedabad|Jaipur|Surat|Lucknow|Kanpur|Nagpur|Indore|'
                r'Thane|Bhopal|Visakhapatnam|Pimpri|Patna|Vadodara|Ghaziabad|'
                r'Ludhiana|Agra|Nashik|Faridabad|Meerut|Rajkot|Kalyan|Vasai|'
                r'Varanasi|Srinagar|Aurangabad|Dhanbad|Amritsar|Navi Mumbai|'
                r'Allahabad|Ranchi|Howrah|Coimbatore|Jabalpur|Gwalior|Vijayawada|'
                r'Jodhpur|Madurai|Raipur|Kota|Guwahati|Chandigarh|Solapur|Hubli|'
                r'Mysore|Tiruchirappalli|Bareilly|Aligarh|Tiruppur|Gurgaon|'
                r'Moradabad|Jalandhar|Bhubaneswar|Salem|Warangal|Guntur|Bhiwandi|'
                r'Saharanpur|Gorakhpur|Bikaner|Amravati|Noida|Jamshedpur|Bhilai|'
                r'Cuttack|Firozabad|Kochi|Nellore|Bhavnagar|Dehradun|Durgapur|'
                r'Asansol|Rourkela|Nanded|Kolhapur|Ajmer|Akola|Gulbarga|Jamnagar|'
                r'Ujjain|Loni|Siliguri|Jhansi|Ulhasnagar|Jammu|Sangli|Mangalore|'
                r'Erode|Belgaum|Ambattur|Tirunelveli|Malegaon|Gaya|Jalgaon|'
                r'Udaipur|Maheshtala)\b', re.IGNORECASE
            ),
            "states": re.compile(
                r'\b(Maharashtra|Delhi|Karnataka|Tamil Nadu|West Bengal|Telangana|'
                r'Gujarat|Rajasthan|Uttar Pradesh|Madhya Pradesh|Andhra Pradesh|'
                r'Bihar|Odisha|Kerala|Jharkhand|Assam|Punjab|Chhattisgarh|Haryana|'
                r'Uttarakhand|Himachal Pradesh|Jammu and Kashmir|Goa|Tripura|'
                r'Meghalaya|Manipur|Nagaland|Arunachal Pradesh|Mizoram|Sikkim)\b', re.IGNORECASE
            ),
        }

        result = {"city": None, "state": None, "latitude": None, "longitude": None, "raw_text": text[:200]}

        # GPS coordinates
        gps_match = location_patterns["gps"].search(text)
        if gps_match:
            lat, lng = float(gps_match.group(1)), float(gps_match.group(2))
            # Validate India bounds
            if 6 <= lat <= 38 and 68 <= lng <= 98:
                result["latitude"] = lat
                result["longitude"] = lng

        # City
        city_match = location_patterns["cities"].search(text)
        if city_match:
            result["city"] = city_match.group(1).title()

        # State
        state_match = location_patterns["states"].search(text)
        if state_match:
            result["state"] = state_match.group(1).title()

        return result

    @classmethod
    def extract_media(cls, post: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract photo/video metadata from post."""
        media = []
        # Common media fields across platforms
        for field in ["media", "media_attachments", "attachments", "images", "videos", "extended_entities"]:
            if field in post and isinstance(post[field], list):
                for item in post[field]:
                    if isinstance(item, dict):
                        media.append({
                            "type": item.get("type") or item.get("media_type") or "image",
                            "url": item.get("url") or item.get("media_url") or item.get("preview_image_url"),
                            "preview_url": item.get("preview_url") or item.get("preview_image_url"),
                            "width": item.get("width"),
                            "height": item.get("height"),
                            "duration": item.get("duration_millis") or item.get("duration"),
                        })
        return media

    @classmethod
    def generate_external_id(cls, post: Dict[str, Any]) -> str:
        """Generate deterministic external ID from post."""
        # Try platform-specific IDs first
        for field in ["id", "id_str", "tweet_id", "status_id", "post_id"]:
            if field in post and post[field]:
                return f"SOCIAL-{str(post[field]).strip()}"

        # Fallback: hash of content + timestamp
        content = f"{post.get('text', '')}{post.get('created_at', '')}{post.get('author_id', '')}"
        return f"SOCIAL-{hashlib.sha256(content.encode()).hexdigest()[:16]}"

    def parse_single_post(self, post: Dict[str, Any]) -> RawIngestionEvent:
        """Transform a raw social post into a RawIngestionEvent."""
        external_id = self.generate_external_id(post)

        # Extract text content
        text = post.get("text") or post.get("content") or post.get("full_text") or ""

        # Extract hashtags
        hashtags = [h.lstrip("#").lower() for h in re.findall(r'#\w+', text)]
        category = self.categorize_from_hashtags(hashtags)

        # Extract location
        location_info = self.extract_location(text)

        # Extract media
        media = self.extract_media(post)

        # Parse timestamp
        created_at = post.get("created_at") or post.get("timestamp") or post.get("date")
        occurred_at = None
        if created_at:
            try:
                if isinstance(created_at, str):
                    occurred_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                elif isinstance(created_at, (int, float)):
                    occurred_at = datetime.fromtimestamp(created_at, tz=timezone.utc)
            except Exception:
                pass

        # Author info
        author = post.get("author") or post.get("user") or post.get("account") or {}
        author_handle = author.get("username") or author.get("screen_name") or author.get("acct") or ""
        author_name = author.get("name") or author.get("display_name") or ""

        payload = {
            "title": f"Social post: {text[:100]}..." if len(text) > 100 else f"Social post: {text}",
            "description": text,
            "latitude": location_info["latitude"],
            "longitude": location_info["longitude"],
            "location_name": f"{location_info['city'] or ''}, {location_info['state'] or ''}".strip(", "),
            "category_code": category,
            "severity": "MODERATE",  # Social posts default to moderate
            "occurred_at": occurred_at.isoformat() if occurred_at else None,
            "external_id": external_id,
            "hashtags": hashtags,
            "author_handle": author_handle,
            "author_name": author_name,
            "media": media,
            "raw_post": post,
        }

        return RawIngestionEvent(
            source_code=self.source_code,
            external_id=external_id,
            payload=payload,
            ingested_at=datetime.now(timezone.utc),
        )

    def parse_source_response(self, raw_data: Any) -> List[RawIngestionEvent]:
        """Extract and parse posts from various API response formats."""
        raw_items: List[Dict[str, Any]] = []

        if isinstance(raw_data, list):
            raw_items = [item for item in raw_data if isinstance(item, dict)]
        elif isinstance(raw_data, dict):
            # Common response envelopes
            for key in ["data", "statuses", "tweets", "posts", "results", "items", "records"]:
                if key in raw_data and isinstance(raw_data[key], list):
                    raw_items = [item for item in raw_data[key] if isinstance(item, dict)]
                    break
            else:
                raw_items = [raw_data]

        events: List[RawIngestionEvent] = []
        for item in raw_items:
            try:
                event = self.parse_single_post(item)
                events.append(event)
            except Exception as e:
                logger.warning(
                    f"Skipping unparseable social post from '{self.source_code}': {e}",
                    extra={"source": self.source_code, "raw_item": item},
                )

        return events

    async def fetch_raw_events(self) -> List[RawIngestionEvent]:
        """
        Fetch raw social media posts from configured hashtags.

        Note: This implementation provides a framework. Real API integration
        requires platform-specific API keys (Twitter/X API v2, etc.).
        When keys are not configured, it logs the attempt and returns empty list
        for demo/development purposes.
        """
        if not self.api_key:
            logger.info(
                f"Social hashtag ingestion skipped for '{self.source_code}': "
                f"SOCIAL_API_KEY not configured (requires platform API access)."
            )
            # Return demo events for testing when no API key
            return self._generate_demo_events()

        headers = self._build_headers()
        all_events: List[RawIngestionEvent] = []

        client = self._custom_client or httpx.AsyncClient(timeout=self.timeout_seconds)
        should_close_client = self._custom_client is None

        try:
            for hashtag in self.hashtags:
                try:
                    # Example endpoint pattern - adjust for actual API
                    params = {
                        "query": f"#{hashtag}",
                        "max_results": min(self.max_results // len(self.hashtags), 100),
                        "tweet.fields": "created_at,author_id,geo,entities,attachments,public_metrics",
                        "expansions": "author_id,geo.place_id",
                    }

                    response = await client.get(
                        f"{self.api_endpoint}/search/recent",
                        headers=headers,
                        params=params,
                    )

                    if response.status_code == 401:
                        logger.warning(f"Social API auth failed for #{hashtag}")
                        raise AdapterFetchError(
                            f"Social API authentication failed for #{hashtag}",
                            source_code=self.source_code,
                        )
                    if response.status_code == 429:
                        logger.warning(f"Social API rate limit for #{hashtag}")
                        raise AdapterFetchError(
                            f"Social API rate limit exceeded for #{hashtag}",
                            source_code=self.source_code,
                        )

                    response.raise_for_status()
                    data = response.json()
                    events = self.parse_source_response(data)
                    all_events.extend(events)

                    logger.info(f"Fetched {len(events)} posts for #{hashtag}")

                except AdapterFetchError:
                    raise
                except Exception as e:
                    logger.warning(f"Error fetching #{hashtag}: {e}")

            return all_events

        except httpx.TimeoutException as e:
            logger.warning(f"Social API request timed out: {e}")
            raise AdapterFetchError(f"Social API request timeout: {e}", source_code=self.source_code)
        except httpx.ConnectError as e:
            logger.warning(f"Social API connection failure: {e}")
            raise AdapterFetchError(f"Social API connection failed: {e}", source_code=self.source_code)
        except Exception as e:
            if isinstance(e, AdapterFetchError):
                raise
            logger.error(f"Unexpected error during social ingestion fetch: {e}", exc_info=True)
            raise AdapterFetchError(f"Unexpected social fetch error: {e}", source_code=self.source_code)
        finally:
            if should_close_client:
                await client.aclose()

    def _generate_demo_events(self) -> List[RawIngestionEvent]:
        """Generate demo social posts for development/testing when API keys unavailable."""
        demo_posts = [
            {
                "id": "demo_1",
                "text": "#IMD alert: Heavy rainfall warning for Mumbai and Thane districts. Citizens advised to avoid low-lying areas. #flood #mumbai #monsoon",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "author": {"username": "weatherwatcher_mum", "name": "Mumbai Weather Watch"},
                "geo": {"coordinates": [72.8777, 19.0760], "place_id": "mumbai"},
                "entities": {"hashtags": [{"tag": "IMD"}, {"tag": "flood"}, {"tag": "mumbai"}, {"tag": "monsoon"}]},
            },
            {
                "id": "demo_2",
                "text": "Waterlogging reported near Andheri subway, Mumbai. Traffic at standstill. #MumbaiRains #waterlogging #IMD",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "author": {"username": "citizen_reporter", "name": "Citizen Reporter"},
                "geo": {"coordinates": [72.8697, 19.1197], "place_id": "andheri"},
                "entities": {"hashtags": [{"tag": "MumbaiRains"}, {"tag": "waterlogging"}, {"tag": "IMD"}]},
                "media": [{"type": "photo", "url": "https://example.com/photo1.jpg"}],
            },
            {
                "id": "demo_3",
                "text": "Cyclone warning issued for Odisha coast. Expected landfall in 24 hours. #cyclone #odisha #IMD #storm",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "author": {"username": "odisha_weather", "name": "Odisha Weather Updates"},
                "geo": {"coordinates": [85.8245, 20.2961], "place_id": "bhubaneswar"},
                "entities": {"hashtags": [{"tag": "cyclone"}, {"tag": "odisha"}, {"tag": "IMD"}, {"tag": "storm"}]},
            },
            {
                "id": "demo_4",
                "text": "Heatwave conditions in Delhi NCR. Temperature touched 45°C today. Stay hydrated! #heatwave #delhi #IMD",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "author": {"username": "delhi_weather", "name": "Delhi Weather"},
                "geo": {"coordinates": [77.1025, 28.7041], "place_id": "delhi"},
                "entities": {"hashtags": [{"tag": "heatwave"}, {"tag": "delhi"}, {"tag": "IMD"}]},
            },
            {
                "id": "demo_5",
                "text": "Landslide blocks highway near Shimla. Rescue operations underway. #landslide #himachal #IMD",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "author": {"username": "hp_disaster", "name": "HP Disaster Management"},
                "geo": {"coordinates": [77.1734, 31.1048], "place_id": "shimla"},
                "entities": {"hashtags": [{"tag": "landslide"}, {"tag": "himachal"}, {"tag": "IMD"}]},
            },
        ]

        events = []
        for post in demo_posts:
            event = self.parse_single_post(post)
            events.append(event)

        logger.info(f"Generated {len(events)} demo social hashtag events")
        return events

    async def normalize(self, raw_event: RawIngestionEvent) -> NormalizedEvidenceEvent:
        """Convert raw social post to NormalizedEvidenceEvent for evidence pipeline."""
        post = raw_event.payload

        # Build text snippet for evidence
        text = post.get("description", "")
        author = post.get("author_name", "")
        handle = post.get("author_handle", "")
        location = post.get("location_name", "")

        snippet_parts = []
        if author:
            snippet_parts.append(f"By {author}")
        if handle:
            snippet_parts.append(f"@{handle}")
        if location:
            snippet_parts.append(f"[{location}]")
        snippet_parts.append(text[:500])
        text_snippet = " | ".join(snippet_parts)

        # Media metadata
        media = post.get("media", [])
        media_metadata = []
        for m in media:
            if isinstance(m, dict):
                media_metadata.append({
                    "type": m.get("type"),
                    "preview_url": m.get("preview_url") or m.get("url"),
                    "url": m.get("url"),
                    "description": m.get("description"),
                })

        # Hash for deduplication
        canonical_url = post.get("url") or f"social://{raw_event.external_id}"
        sha256_hash = hashlib.sha256(canonical_url.encode()).hexdigest()

        return NormalizedEvidenceEvent(
            source_code=self.source_code,
            external_id=raw_event.external_id,
            evidence_type="SOCIAL_POST",
            title=post.get("title", "Social media post"),
            url=canonical_url,
            publisher_domain="social.media",
            language="en",
            published_at=post.get("occurred_at"),
            text_snippet=text_snippet,
            sha256_hash=sha256_hash,
            raw_payload={
                **post,
                "media_metadata": media_metadata,
                "hashtags": post.get("hashtags", []),
            },
        )