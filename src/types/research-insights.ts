export interface ResearchInsightData {
  executive_summary: ExecutiveSummary;
  reason_code_distribution: ReasonCodeItem[];
  issue_clusters: IssueCluster[];
  top_actions: TopAction[] | TopActionsGrouped;
  payment_friction_analysis: FrictionAnalysis;
  transfer_friction_analysis: FrictionAnalysis;
  operational_blind_spots: BlindSpot[];
  host_accountability_flags: HostAccountabilityFlag[];
  agent_performance_summary: AgentPerformanceSummary;
  emerging_patterns: EmergingPattern[];
  _progress?: InsightProgress;
}

export interface ExecutiveSummary {
  headline?: string;
  title?: string;
  key_findings?: string;
  key_finding?: string;
  recommendations?: string[];
  recommendation_summary?: string;
  urgent_recommendation?: string;
  total_cases_analyzed?: number;
  total_cases?: number;
  preventable_percent?: number;
  addressable_pct?: number;
  top_reason?: string;
  avg_preventability?: number;
  avg_preventability_score?: number;
  urgent_quote?: string;
  quantified_impact?: string;
  period?: string;
  date_range?: string;
  high_regret_count?: number;
  high_regret_pct?: number;
  payment_related_pct?: number;
  host_related_pct?: number;
}

export interface ReasonCodeItem {
  code?: string;
  reason_group?: string;
  category?: string;
  count: number;
  pct?: number;
  percentage?: number;
  severity?: string;
  description?: string;
  details?: string;
  addressability?: string;
  preventability?: number;
  regrettability?: string;
  sub_codes?: string[];
  example_quotes?: string[];
  booking_ids?: string[];
  reason_codes_included?: string[];
}

export interface IssueCluster {
  cluster_name: string;
  description?: string;
  cluster_description?: string;
  priority?: string;
  recommended_action?: string | { action: string; owner?: string; priority?: string };
  supporting_quotes?: string[];
  representative_quotes?: string[];
  key_quotes?: string[];
  frequency?: number;
  case_count?: number;
  systemic_root_cause?: string;
  root_cause?: string;
}

export interface TopAction {
  rank?: number;
  action: string;
  description?: string;
  rationale?: string;
  impact?: string;
  priority?: string;
  ownership?: string;
  owner?: string;
  effort?: string;
  cases_affected?: number;
  pct_of_batch?: number;
  quick_win?: string | null;
  timeline?: string;
}

export interface TopActionsGrouped {
  p0_immediate_risk_mitigation?: TopAction[];
  p1_systemic_process_redesign?: TopAction[];
  quick_wins?: TopAction[];
}

export interface FrictionPoint {
  point: string;
  severity?: string;
  frequency?: number;
  description?: string;
  impact?: string;
  quote?: string;
}

export interface FrictionAnalysis {
  friction_points?: FrictionPoint[];
  key_friction_points?: FrictionPoint[];
  stats?: Record<string, string | number>;
  summary?: string;
  retention_rate?: number;
  resolution_rate?: number;
}

export interface BlindSpot {
  blind_spot?: string;
  title?: string;
  description?: string;
  severity?: string;
  recommendation?: string;
}

export interface HostAccountabilityFlag {
  flag?: string;
  issue_pattern?: string;
  issue?: string;
  priority?: string;
  description?: string;
  frequency?: number;
  host_type?: string;
  recommendation?: string;
  quote?: string;
}

export interface AgentPerformanceSummary {
  strengths?: string[] | Array<{ area: string; description?: string }>;
  weaknesses?: string[] | Array<{ area: string; description?: string }>;
  coaching_opportunities?: Array<{ area: string; description?: string; recommendation?: string }>;
  top_performers?: string[];
  common_gaps?: string[];
}

export interface EmergingPattern {
  pattern: string;
  status?: string;
  description?: string;
  evidence?: string;
  frequency?: number;
  trend?: string;
  first_seen?: string;
  quote?: string;
}

export interface InsightProgress {
  totalChunks: number;
  completedChunks: number;
  totalRecords: number;
  currentPhase: string;
}

export interface ProcessingStats {
  totalResearchRecords: number;
  processedRecords: number;
  pendingRecords: number;
  humanReviewCount: number;
}

export function deriveKPIs(data: ResearchInsightData | null, stats: ProcessingStats | null) {
  if (!data) {
    return {
      totalCases: stats?.processedRecords ?? 0,
      preventablePercent: 0,
      topReasonCode: '—',
      flaggedForReview: stats?.humanReviewCount ?? 0,
      avgPreventability: 0,
    };
  }
  const es = data.executive_summary;
  const reasons = Array.isArray(data.reason_code_distribution) ? data.reason_code_distribution : [];
  const totalFromReasons = reasons.reduce((s, r) => s + r.count, 0);

  return {
    totalCases: es?.total_cases_analyzed ?? es?.total_cases ?? stats?.processedRecords ?? totalFromReasons,
    preventablePercent: es?.preventable_percent ?? es?.addressable_pct ?? 0,
    topReasonCode: reasons[0]?.code ?? reasons[0]?.reason_group ?? reasons[0]?.category ?? es?.top_reason ?? '—',
    flaggedForReview: stats?.humanReviewCount ?? 0,
    avgPreventability: es?.avg_preventability ?? es?.avg_preventability_score ?? 0,
  };
}
