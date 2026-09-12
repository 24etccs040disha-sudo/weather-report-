/**
 * Verdict Inspector - Side-by-side fake detection exposé screen
 * Makes the credibility/fake detection process fully transparent and explainable
 * Shows: duplicate clusters, image hash matches, sensor corroboration, source trust, full driver breakdown
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Scale,
  CopyCheck,
  AlertTriangle,
  Eye,
  ImageIcon,
  Wifi,
  Database,
  GitCompare,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Hash,
  MapPin,
  Clock,
  Camera,
  Video,
  Layers,
  Search,
  Info,
  Loader2,
} from 'lucide-react';
import { incidentApi } from '@/services/incidentApi';
import { incidentKeys } from '@/lib/queryKeys';
import { IncidentIntelligence } from '@/types/intelligence';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorCard } from '@/components/common/ErrorCard';

interface VerdictInspectorProps {
  incidentId: string;
  initialData?: IncidentIntelligence;
  onClose?: () => void;
}

export const VerdictInspector: React.FC<VerdictInspectorProps> = ({
  incidentId,
  initialData,
  onClose,
}) => {
  const { data: response, isLoading, isError, error, refetch } = useQuery({
    queryKey: incidentKeys.intelligence(incidentId),
    queryFn: ({ signal }) => incidentApi.getIncidentIntelligence(incidentId, signal),
    staleTime: 1000 * 60,
  });

  const intel = response?.data || initialData;
  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
    duplicate: true,
    evidence: true,
    sensor: true,
    credibility: true,
    provenance: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const renderScoreBadge = (score: number | null | undefined, label: string) => {
    if (score == null) return null;
    const pct = Math.round(score * 100);
    const color =
      pct >= 75 ? 'bg-emerald-100 text-emerald-700' :
      pct >= 50 ? 'bg-amber-100 text-amber-700' :
      pct >= 25 ? 'bg-orange-100 text-orange-700' :
      'bg-rose-100 text-rose-700';
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-bold ${color}`}>
        {label}: {pct}%
      </span>
    );
  };

  const DriverBadge = ({ text, type }: { text: string; type: 'positive' | 'negative' | 'neutral' }) => {
    const colors = {
      positive: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      negative: 'bg-rose-50 text-rose-800 border-rose-200',
      neutral: 'bg-amber-50 text-amber-800 border-amber-200',
    };
    const icons = {
      positive: <CopyCheck className="h-3 w-3 text-emerald-600" />,
      negative: <AlertTriangle className="h-3 w-3 text-rose-600" />,
      neutral: <Info className="h-3 w-3 text-amber-600" />,
    };
    return (
      <div className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border ${colors[type]}`}>
        {icons[type]}
        <span className="text-xs font-medium">{text}</span>
      </div>
    );
  };

  const SectionHeader = ({
    title,
    icon,
    sectionKey,
    badge,
    children,
  }: {
    title: string;
    icon: React.ReactNode;
    sectionKey: string;
    badge?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900">{title}</h4>
          {children && <span className="text-[11px] text-slate-400">{children}</span>}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        {badge}
        <button
          onClick={() => toggleSection(sectionKey)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          aria-label={expandedSections[sectionKey] ? 'Collapse' : 'Expand'}
        >
          {expandedSections[sectionKey] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  if (isLoading && !initialData) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <LoadingSkeleton count={3} className="h-24" />
      </div>
    );
  }

  if (isError && !initialData) {
    return (
      <ErrorCard
        title="Verdict Unavailable"
        message={error instanceof Error ? error.message : 'Unable to fetch intelligence data.'}
        onRetry={() => refetch()}
      />
    );
  }

  if (!intel) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs text-center text-slate-500">
        No intelligence data available for this incident.
      </div>
    );
  }

  const cluster = intel.duplicate_cluster;
  const evidence = intel.linked_evidence;
  const observations = intel.physical_observations;
  const credibility = intel.credibility;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Scale className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Verdict Inspector</h3>
            <span className="text-[11px] text-slate-400 font-medium block">
              Transparent breakdown of how this incident was assessed
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              aria-label="Close"
            >
              <ChevronRight className="h-4 w-4 rotate-90" />
            </button>
          )}
          {renderScoreBadge(credibility?.score, 'Credibility')}
          {renderScoreBadge(intel.verification_probability, 'Verify Prob.')}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 sm:p-6 space-y-6">
        {/* 1. Duplicate Cluster Analysis */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <SectionHeader
              title="Duplicate Cluster Analysis"
              icon={<GitCompare className="h-4 w-4" />}
              sectionKey="duplicate"
              badge={cluster && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700">
                  {cluster.member_count} members
                </span>
              )}
            />
          </div>
          {expandedSections.duplicate && (
            <div className="p-4 space-y-4">
              {cluster && cluster.member_count > 1 ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <Search className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-800">
                        This report is part of a duplicate cluster with <strong>{cluster.member_count}</strong> related reports.
                      </span>
                    </div>
                    <p className="text-xs text-blue-700 mt-1">
                      Only the strongest signal from this cluster contributes to credibility.
                      Diminishing returns applied: each additional report adds less weight.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Cluster Members</h5>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      {cluster.members?.slice(0, 10).map((member: any, idx: number) => (
                        <div
                          key={member.id || idx}
                          className={`flex items-center justify-between px-3 py-2 border-t border-slate-100 ${
                            member.is_primary ? 'bg-emerald-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                            {member.is_primary && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded">
                                PRIMARY
                              </span>
                            )}
                            <span className="text-sm font-medium text-slate-900">{member.tracking_id}</span>
                            <span className="text-xs text-slate-500">{member.category}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-xs">
                            <span className={`px-2 py-0.5 rounded ${
                              member.verification_status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' :
                              member.verification_status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {member.verification_status}
                            </span>
                            <span className="text-slate-500">Score: {Math.round((member.credibility_score || 0) * 100)}%</span>
                          </div>
                        </div>
                      ))}
                      {(cluster.members?.length || 0) > 10 && (
                        <div className="px-3 py-2 text-center text-xs text-slate-500 border-t border-slate-100 bg-slate-50">
                          +{cluster.members.length - 10} more members
                        </div>
                      )}
                    </div>
                  </div>

                  {cluster.similarity_matrix && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Similarity Scores (top pairs)</h5>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {cluster.similarity_matrix.slice(0, 6).map((pair: any, idx: number) => (
                          <div key={idx} className="p-2 rounded-lg bg-slate-50 text-center">
                            <div className="text-2xl font-bold text-indigo-600">{Math.round(pair.similarity * 100)}%</div>
                            <div className="text-[10px] text-slate-500">{pair.id_a?.slice(-8)} ↔ {pair.id_b?.slice(-8)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-4 text-center">
                  <CopyCheck className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-medium text-emerald-800">No duplicate cluster detected</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    This report stands alone — no similar reports found within spatial/temporal thresholds.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Digital Evidence (Image/Video Hash Matching) */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <SectionHeader
              title="Digital Evidence Verification"
              icon={<ImageIcon className="h-4 w-4" />}
              sectionKey="evidence"
              badge={evidence && evidence.length > 0 && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700">
                  {evidence.length} items
                </span>
              )}
            />
          </div>
          {expandedSections.evidence && (
            <div className="p-4 space-y-4">
              {evidence && evidence.length > 0 ? (
                <div className="space-y-3">
                  {evidence.map((item: any, idx: number) => (
                    <div key={idx} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            {item.type === 'VIDEO' ? <Video className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {item.type || 'IMAGE'} Evidence #{idx + 1}
                            </p>
                            <p className="text-xs text-slate-500">
                              SHA-256: <span className="font-mono">{item.sha256_hash?.slice(0, 16)}...</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                              title="View original"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>

                      {item.hash_matches && item.hash_matches.length > 0 && (
                        <div className="mt-3 p-3 rounded-lg border border-rose-200 bg-rose-50/40">
                          <div className="flex items-center space-x-2 text-xs text-rose-800 mb-2">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            <span className="font-medium">Duplicate Image/Video Detected!</span>
                          </div>
                          <div className="space-y-1 pl-5">
                            {item.hash_matches.map((match: any, mi: number) => (
                              <div key={mi} className="flex items-center space-x-2 text-[11px] text-rose-700">
                                <Hash className="h-3 w-3" />
                                <span>Matched with <strong>{match.incident_id}</strong> (similarity: {match.similarity}%)</span>
                                {match.is_exact_match && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 rounded">EXACT MATCH</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.reverse_search_results && item.reverse_search_results.length > 0 && (
                        <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50/40">
                          <div className="flex items-center space-x-2 text-xs text-amber-800 mb-2">
                            <Search className="h-3.5 w-3.5" />
                            <span className="font-medium">Reverse Search Results</span>
                          </div>
                          <div className="space-y-1 pl-5">
                            {item.reverse_search_results.slice(0, 3).map((result: any, ri: number) => (
                              <div key={ri} className="flex items-center space-x-2 text-[11px] text-amber-800">
                                <Info className="h-3 w-3" />
                                <span>{result.source}: {result.description}</span>
                                {result.url && (
                                  <a href={result.url} target="_blank" rel="noopener" className="text-amber-600 hover:underline">
                                    View
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!item.hash_matches?.length && !item.reverse_search_results?.length && (
                        <div className="mt-3 p-3 rounded-lg border border-emerald-100 bg-emerald-50/40 text-center">
                          <CopyCheck className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                          <p className="text-xs text-emerald-800">No duplicate media found — appears unique</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                  <ImageIcon className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm font-medium text-slate-600">No digital evidence attached</p>
                  <p className="text-xs text-slate-500 mt-1">This report has no photos or videos to verify</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Physical Sensor Corroboration */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <SectionHeader
              title="Physical Sensor Corroboration"
              icon={<Wifi className="h-4 w-4" />}
              sectionKey="sensor"
              badge={observations && observations.length > 0 && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700">
                  {observations.length} stations
                </span>
              )}
            />
          </div>
          {expandedSections.sensor && (
            <div className="p-4 space-y-4">
              {observations && observations.length > 0 ? (
                <div className="space-y-3">
                  {observations.map((obs: any, idx: number) => (
                    <div key={idx} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                            <Database className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{obs.station_name || obs.station_id}</p>
                            <p className="text-xs text-slate-500 flex items-center space-x-1">
                              <MapPin className="h-3 w-3" />
                              <span>{obs.distance_km?.toFixed(1)} km away</span>
                              {obs.direction && <span>· {obs.direction}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            obs.corroboration === 'CORROBORATING' ? 'bg-emerald-100 text-emerald-700' :
                            obs.corroboration === 'CONSISTENT' ? 'bg-blue-100 text-blue-700' :
                            obs.corroboration === 'WEAK' ? 'bg-amber-100 text-amber-700' :
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {obs.corroboration}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {obs.temperature != null && (
                          <div className="p-2 rounded bg-slate-50">
                            <div className="text-slate-500">Temperature</div>
                            <div className="font-mono text-slate-900">{obs.temperature}°C</div>
                          </div>
                        )}
                        {obs.humidity != null && (
                          <div className="p-2 rounded bg-slate-50">
                            <div className="text-slate-500">Humidity</div>
                            <div className="font-mono text-slate-900">{obs.humidity}%</div>
                          </div>
                        )}
                        {obs.rainfall_24h != null && (
                          <div className="p-2 rounded bg-slate-50">
                            <div className="text-slate-500">Rainfall (24h)</div>
                            <div className="font-mono text-slate-900">{obs.rainfall_24h} mm</div>
                          </div>
                        )}
                        {obs.wind_speed != null && (
                          <div className="p-2 rounded bg-slate-50">
                            <div className="text-slate-500">Wind Speed</div>
                            <div className="font-mono text-slate-900">{obs.wind_speed} km/h</div>
                          </div>
                        )}
                        {obs.pressure != null && (
                          <div className="p-2 rounded bg-slate-50">
                            <div className="text-slate-500">Pressure</div>
                            <div className="font-mono text-slate-900">{obs.pressure} hPa</div>
                          </div>
                        )}
                        {obs.water_level != null && (
                          <div className="p-2 rounded bg-slate-50">
                            <div className="text-slate-500">Water Level</div>
                            <div className="font-mono text-slate-900">{obs.water_level} m</div>
                          </div>
                        )}
                      </div>

                      {obs.threshold_comparison && (
                        <div className="mt-3 p-2 rounded bg-slate-50">
                          <div className="text-xs text-slate-500">Threshold Analysis:</div>
                          <div className="text-xs font-mono text-slate-900 mt-0.5">
                            {Object.entries(obs.threshold_comparison).map(([key, val]: any) => (
                              <div key={key} className="flex justify-between">
                                <span>{key}</span>
                                <span className={val.exceeds ? 'text-rose-600' : 'text-emerald-600'}>
                                  {val.exceeds ? 'EXCEEDS' : 'within'} threshold ({val.value} vs {val.threshold})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-4 text-center">
                  <Wifi className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                  <p className="text-sm font-medium text-amber-800">No nearby sensor observations</p>
                  <p className="text-xs text-amber-700 mt-1">
                    No AWS/hydrological stations within corroboration radius.
                    Cannot physically verify this report.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Credibility Score Breakdown */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <SectionHeader
              title="Credibility Score Breakdown"
              icon={<Scale className="h-4 w-4" />}
              sectionKey="credibility"
              badge={credibility && renderScoreBadge(credibility.score, 'Score')}
            />
          </div>
          {expandedSections.credibility && (
            <div className="p-4 space-y-4">
              {credibility && (
                <div className="space-y-4">
                  {/* Score Gauge */}
                  <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-bold text-slate-900">Machine Credibility Score</h5>
                      <span className="text-2xl font-extrabold text-indigo-600">
                        {Math.round((credibility.score || 0) * 100)}%
                      </span>
                    </div>
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (credibility.score || 0) >= 0.75 ? 'bg-emerald-500' :
                          (credibility.score || 0) >= 0.5 ? 'bg-amber-500' :
                          'bg-rose-500'
                        }`}
                        style={{ width: `${Math.round((credibility.score || 0) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span>100%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">
                      <strong className="text-slate-700">Note:</strong> This is an algorithmic assessment, not human ground truth.
                      Final verification status is set by operators.
                    </p>
                  </div>

                  {/* Formula Explanation */}
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-2 flex items-center space-x-1">
                      <Info className="h-3.5 w-3.5" />
                      <span>Scoring Formula (v1 deterministic)</span>
                    </h5>
                    <pre className="text-[10px] font-mono text-indigo-900 bg-indigo-100/50 p-2 rounded overflow-x-auto">
{`Score = floor(QUALITY_FLOOR * QUALITY_SCALE)
       + min(CROWD * count, CAP)
       + min(EVIDENCE * count, CAP)
       + min(OBSERVATION * count, CAP)
       + DIVERSITY_INCREMENT * unique_provenance_count
       - PENALTIES (fake_flags, contradictions)
       
Capped by: provenance type, max_machine (0.98)`}
                    </pre>
                  </div>

                  {/* Drivers */}
                  <div className="space-y-3">
                    {credibility.positive_drivers?.length && (
                      <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center space-x-1">
                          <CopyCheck className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Supporting Drivers ({credibility.positive_drivers.length})</span>
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {credibility.positive_drivers.map((d: string, i: number) => (
                            <DriverBadge key={i} text={d} type="positive" />
                          ))}
                        </div>
                      </div>
                    )}

                    {credibility.negative_drivers?.length && (
                      <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center space-x-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                          <span>Contradicting / Penalizing Factors ({credibility.negative_drivers.length})</span>
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {credibility.negative_drivers.map((d: string, i: number) => (
                            <DriverBadge key={i} text={d} type="negative" />
                          ))}
                        </div>
                      </div>
                    )}

                    {credibility.uncertainty_flags?.length && (
                      <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center space-x-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          <span>Uncertainty Flags ({credibility.uncertainty_flags.length})</span>
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {credibility.uncertainty_flags.map((f: string, i: number) => (
                            <DriverBadge key={i} text={f} type="neutral" />
                          ))}
                        </div>
                      </div>
                    )}

                    {!credibility.positive_drivers?.length && !credibility.negative_drivers?.length && !credibility.uncertainty_flags?.length && (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No detailed driver breakdown available
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. Source Provenance & Trust */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <SectionHeader
              title="Source Provenance & Trust"
              icon={<Layers className="h-4 w-4" />}
              sectionKey="provenance"
            />
          </div>
          {expandedSections.provenance && (
            <div className="p-4 space-y-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Source Trust Weights</h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded bg-slate-50">
                    <div className="text-slate-500">Official Gov (IMD/NDMA)</div>
                    <div className="font-bold text-emerald-700">0.90</div>
                  </div>
                  <div className="p-2 rounded bg-slate-50">
                    <div className="text-slate-500">IMD Social Media</div>
                    <div className="font-bold text-blue-700">0.70</div>
                  </div>
                  <div className="p-2 rounded bg-slate-50">
                    <div className="text-slate-500">Citizen Report</div>
                    <div className="font-bold text-amber-700">0.50</div>
                  </div>
                  <div className="p-2 rounded bg-slate-50">
                    <div className="text-slate-500">Social Media</div>
                    <div className="font-bold text-rose-700">0.40</div>
                  </div>
                </div>
              </div>

              {intel.provenance_summary && (
                <div className="rounded-lg border border-slate-200 p-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Provenance Breakdown</h5>
                  <div className="space-y-2">
                    {Object.entries(intel.provenance_summary).map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 capitalize">{source.replace('_', ' ')}</span>
                        <span className="font-mono font-bold text-slate-900">{count} reports</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <strong className="text-slate-700">Key Principle:</strong> Crowd volume ≠ independent confirmations.
                Duplicate reports are clustered with a single diminishing-returns sub-signal,
                never summed as independent corroborating proofs.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerdictInspector;