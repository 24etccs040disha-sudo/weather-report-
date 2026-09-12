"""Pydantic schemas for operational incident resource representations."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.orchestration.events import OverallReadiness
from app.schemas.report import (
    CategoryDetail,
    MediaDetail,
    PaginationMeta,
    SeverityType,
    VerificationEventDetail,
)


class IncidentLocationResponse(BaseModel):
    """Geographic location resolution summary."""

    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(default=None, description="Human-readable place name.")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    resolution_status: str = Field(
        default="STRUCTURED", description="RESOLVED, AMBIGUOUS, UNRESOLVED."
    )
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class IncidentCredibilitySummary(BaseModel):
    """Compact machine credibility representation."""

    model_config = ConfigDict(from_attributes=True)

    score: float = Field(..., ge=0.0, le=1.0, description="Machine-assessed credibility score.")
    is_machine_assessed: bool = True
    label: str = Field(default="MODERATE_CREDIBILITY")
    engine_version: str = "v1"
    policy_version: str = "v1"
    explanation: Optional[str] = None


class IncidentVerificationSummary(BaseModel):
    """Human verification status representation."""

    model_config = ConfigDict(from_attributes=True)

    status: str = Field(..., description="PENDING, UNDER_REVIEW, VERIFIED, REJECTED, DUPLICATE.")
    is_human_verified: bool = False
    verified_at: Optional[datetime] = None


class IncidentIntelligenceSummary(BaseModel):
    """Compact orchestration intelligence readiness summary."""

    model_config = ConfigDict(from_attributes=True)

    overall_readiness: OverallReadiness
    last_computed_at: Optional[datetime] = None


class IncidentCorroborationCounts(BaseModel):
    """Aggregate counts for linked signals."""

    model_config = ConfigDict(from_attributes=True)

    evidence_count: int = 0
    observation_count: int = 0
    duplicate_cluster_size: int = 1
    is_cluster_representative: bool = True


# --- Verdict Inspector Full Intelligence Schemas ---

class DuplicateClusterMemberSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    tracking_id: str
    category: str
    verification_status: str
    credibility_score: float
    is_primary: bool
    occurred_at: datetime


class DuplicateClusterSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    cluster_id: uuid.UUID
    member_count: int
    members: List[DuplicateClusterMemberSchema] = Field(default_factory=list)
    similarity_matrix: List[Dict[str, Any]] = Field(default_factory=list)


class HashMatchSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    incident_id: str
    similarity: float
    is_exact_match: bool
    matched_at: datetime


class ReverseSearchResultSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    source: str
    description: str
    url: Optional[str] = None
    similarity: Optional[float] = None


class LinkedEvidenceItemSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    type: str
    sha256_hash: str
    url: Optional[str] = None
    preview_url: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[int] = None
    hash_matches: List[HashMatchSchema] = Field(default_factory=list)
    reverse_search_results: List[ReverseSearchResultSchema] = Field(default_factory=list)


class PhysicalObservationSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    station_id: str
    station_name: str
    distance_km: float
    direction: Optional[str] = None
    corroboration: str
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    rainfall_24h: Optional[float] = None
    wind_speed: Optional[float] = None
    pressure: Optional[float] = None
    water_level: Optional[float] = None
    threshold_comparison: Optional[Dict[str, Any]] = None
    observed_at: datetime


class CredibilitySummarySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    score: float
    label: str
    explanation_text: Optional[str] = None
    positive_drivers: List[str] = Field(default_factory=list)
    negative_drivers: List[str] = Field(default_factory=list)
    uncertainty_flags: List[str] = Field(default_factory=list)


class ProvenanceSummarySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    __root__: Dict[str, int]


class IncidentIntelligenceDetailData(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    incident_id: uuid.UUID
    verification_probability: Optional[float] = None
    duplicate_cluster: Optional[DuplicateClusterSchema] = None
    linked_evidence: List[LinkedEvidenceItemSchema] = Field(default_factory=list)
    physical_observations: List[PhysicalObservationSchema] = Field(default_factory=list)
    credibility: Optional[CredibilitySummarySchema] = None
    provenance_summary: Optional[ProvenanceSummarySchema] = None


class IncidentIntelligenceDetailResponse(BaseModel):
    success: bool = True
    data: IncidentIntelligenceDetailData
    meta: dict = Field(default_factory=dict)


class IncidentSummaryResponse(BaseModel):
    """Compact incident summary for feed lists, tables, and map overlays."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tracking_id: str
    title: str
    category: CategoryDetail
    severity: SeverityType
    location: IncidentLocationResponse
    occurred_at: datetime
    verification_status: str
    credibility_score: float = Field(..., ge=0.0, le=1.0)
    readiness: OverallReadiness
    media_count: int = 0
    created_at: datetime


class IncidentDetailPublic(BaseModel):
    """Public operational incident detail with bounded summaries and PII/audit redacted."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tracking_id: str
    title: str
    description: Optional[str] = None
    category: CategoryDetail
    severity: SeverityType
    location: IncidentLocationResponse
    occurred_at: datetime
    credibility: IncidentCredibilitySummary
    verification: IncidentVerificationSummary
    intelligence_status: IncidentIntelligenceSummary
    summaries: IncidentCorroborationCounts
    media: List[MediaDetail] = Field(default_factory=list)
    created_at: datetime


class IncidentDetailOperator(IncidentDetailPublic):
    """Full operational incident detail for authorized DEOC/SDRF operators with audit history."""

    verification_history: List[VerificationEventDetail] = Field(default_factory=list)
    orchestration_stages: Dict[str, Any] = Field(default_factory=dict)


class IncidentListResponse(BaseModel):
    """Standard API envelope for paginated incident summaries."""

    success: bool = True
    data: List[IncidentSummaryResponse] = Field(default_factory=list)
    pagination: PaginationMeta
    meta: dict = Field(default_factory=dict)


class IncidentDetailResponse(BaseModel):
    """Standard API envelope for incident detail."""

    success: bool = True
    data: IncidentDetailPublic
    meta: dict = Field(default_factory=dict)


class IncidentOperatorDetailResponse(BaseModel):
    """Standard API envelope for operator incident detail."""

    success: bool = True
    data: IncidentDetailOperator
    meta: dict = Field(default_factory=dict)
