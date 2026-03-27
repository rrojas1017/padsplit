// src/types/research-insights.ts
// Shared TypeScript interfaces for the research insights JSONB report shape.
// Replaces all inline `any` types across the 14 components.
// Derived from the actual data written by generate-research-insights edge function.

// ── Report envelope (row from research_insights table) ──

export interface ResearchInsightRow {
  id: string;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: ResearchInsightData;
  total_records_analyzed: number;
  campaign_id?: string;
  campaign_name?: string;
  generated_by?: string;
  error_message?: string;
}

// ── The JSONB blob inside data column ──

export interface ResearchInsightData {
  executive_summary: ExecutiveSummary;
  reason_code_distribution: ReasonCodeItem[];
  issue_clusters: IssueCluster[];
  top_actions: TopAction[];
  payment_friction_analysis: FrictionAnalysis;
  transfer_friction_analysis: FrictionAnalysis;
  operational_blind_spots: BlindSpot[];
  host_accountability_flags: HostAccountabilityFlag[];
  agent_performance_summary: AgentPerformanceSummary;
  emerging_patterns: EmergingPattern[];
  _progress?: InsightProgress;
}

// ── Executive Summary ──

export interface ExecutiveSummary {
  headline: string;
  key_findings: string[];
  recommendations: string[];
  total_cases_analyzed?: number;
  preventable_percent?: number;
  top_reason?: string;
  avg_preventability?: number;
}

// ── Reason Code Distribution ──

export interface ReasonCodeItem {
  code: string;
  count: number;
  percentage: number;
  severity?: 'Critical' | 'High' | 'Medium' | 'Low';
  description?: string;
  addressability?: 'Addressable' | 'Partially addressable' | 'Not addressable';
  preventability?: number;
  regrettability?: 'High' | 'Medium' | 'Low';
  sub_codes?: string[];
  example_quotes?: string[];
}

// ── Issue Clusters ──

export interface IssueCluster {
  name: string;
  codes: string[];
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  root_cause: string;
  action: string;
  owner?: string;
  effort?: 'Low' | 'Medium' | 'High';
  case_count?: number;
  quotes?: string[];
}

// ── Top Actions ──

export interface TopAction {
  rank?: number;
  action: string;
  impact: string;
  priority: 'P0' | 'P1' | 'Quick Win';
  owner?: string;
  effort?: 'Low' | 'Medium' | 'High';
  cases?: number;
  timeline?: string;
}

// ── Friction Analysis (shared shape for payment + transfer) ──

export interface FrictionPoint {
  point: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  frequency?: number;
  description?: string;
  impact?: string;
}

export interface FrictionAnalysis {
  friction_points: FrictionPoint[];
  stats?: Record<string, string | number>;
  summary?: string;
  retention_rate?: number;
  resolution_rate?: number;
}

// ── Blind Spots ──

export interface BlindSpot {
  title: string;
  description: string;
  severity?: 'Critical' | 'High' | 'Medium' | 'Low';
  recommendation?: string;
}

// ── Host Accountability ──

export interface HostAccountabilityFlag {
  issue: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  description?: string;
  frequency?: number;
  host_type?: string;
  recommendation?: string;
}

// ── Agent Performance ──

export interface AgentPerformanceSummary {
  strengths: string[];
  weaknesses: string[];
  coaching_opportunities?: string[];
  top_performers?: string[];
  common_gaps?: string[];
}

// ── Emerging Patterns ──

export interface EmergingPattern {
  pattern: string;
  status: 'act' | 'investigate' | 'monitor' | 'watch';
  description?: string;
  frequency?: number;
  trend?: 'increasing' | 'stable' | 'decreasing';
  first_seen?: string;
}

// ── Generation Progress (internal) ──

export interface InsightProgress {
  totalChunks: number;
  completedChunks: number;
  totalRecords: number;
  currentPhase: 'chunking' | 'analyzing' | 'synthesizing' | 'complete' | 'failed';
}

// ── Processing Stats (from useResearchInsightsData) ──

export interface ProcessingStats {
  total_research_records: number;
  processed_records: number;
  flagged_for_review: number;
  pending_records: number;
  failed_records: number;
}

// ── KPI derivation helper ──

export function deriveKPIs(data: ResearchInsightData | null, stats: ProcessingStats | null) {
  if (!data) {
    return {
      totalCases: stats?.processed_records ?? 0,
      preventablePercent: 0,
      topReasonCode: '—',
      flaggedForReview: stats?.flagged_for_review ?? 0,
      avgPreventability: 0,
    };
  }

  const reasons = data.reason_code_distribution || [];
  const addressableCount = reasons.filter(
    (r) => r.addressability === 'Addressable' || r.addressability === 'Partially addressable'
  ).length;

  return {
    totalCases:
      data.executive_summary?.total_cases_analyzed ??
      stats?.processed_records ??
      reasons.reduce((sum, r) => sum + r.count, 0),
    preventablePercent:
      data.executive_summary?.preventable_percent ??
      (reasons.length > 0 ? Math.round((addressableCount / reasons.length) * 100) : 0),
    topReasonCode:
      reasons[0]?.code ?? data.executive_summary?.top_reason ?? '—',
    flaggedForReview: stats?.flagged_for_review ?? 0,
    avgPreventability:
      data.executive_summary?.avg_preventability ??
      (reasons.length > 0
        ? reasons.reduce((sum, r) => sum + (r.preventability ?? 0), 0) / reasons.length
        : 0),
  };
}
