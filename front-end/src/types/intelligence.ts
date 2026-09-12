// Intelligence Pipeline Orchestration Readiness and Stage Telemetry
// + Verdict Inspector types for transparent fake detection

import { OverallReadiness, StageOutcome } from './enums';

export interface StageStatusSummary {
  status: StageOutcome;
  attempt: number;
  duration_ms: number | null;
  error_message: string | null;
  summary: string | null;
}

export interface IncidentIntelligenceData {
  incident_id: string;
  overall_readiness: OverallReadiness;
  last_successful_stage: string | null;
  stages: Record<string, StageStatusSummary>;
}

// --- Verdict Inspector Types ---

export interface CredibilitySummary {
  score: number;
  label: string;
  explanation_text?: string;
  positive_drivers?: string[];
  negative_drivers?: string[];
  uncertainty_flags?: string[];
}

export interface DuplicateClusterMember {
  id: string;
  tracking_id: string;
  category: string;
  verification_status: string;
  credibility_score: number;
  is_primary: boolean;
  occurred_at: string;
}

export interface DuplicateCluster {
  cluster_id: string;
  member_count: number;
  members: DuplicateClusterMember[];
  similarity_matrix?: Array<{
    id_a: string;
    id_b: string;
    similarity: number;
  }>;
}

export interface HashMatch {
  incident_id: string;
  similarity: number;
  is_exact_match: boolean;
  matched_at: string;
}

export interface ReverseSearchResult {
  source: string;
  description: string;
  url?: string;
  similarity?: number;
}

export interface LinkedEvidenceItem {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  sha256_hash: string;
  url?: string;
  preview_url?: string;
  width?: number;
  height?: number;
  duration?: number;
  hash_matches?: HashMatch[];
  reverse_search_results?: ReverseSearchResult[];
}

export interface PhysicalObservation {
  station_id: string;
  station_name: string;
  distance_km: number;
  direction?: string;
  corroboration: 'CORROBORATING' | 'CONSISTENT' | 'WEAK' | 'CONTRADICTING';
  temperature?: number;
  humidity?: number;
  rainfall_24h?: number;
  wind_speed?: number;
  pressure?: number;
  water_level?: number;
  threshold_comparison?: Record<string, {
    value: number;
    threshold: number;
    exceeds: boolean;
  }>;
  observed_at: string;
}

export interface ProvenanceSummary {
  [source: string]: number;
}

export interface IncidentIntelligence {
  incident_id: string;
  verification_probability?: number;
  duplicate_cluster?: DuplicateCluster;
  linked_evidence?: LinkedEvidenceItem[];
  physical_observations?: PhysicalObservation[];
  credibility?: CredibilitySummary;
  provenance_summary?: ProvenanceSummary;
}