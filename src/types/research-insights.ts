// src/types/research-insights.ts
// Shared TypeScript interfaces for the research insights JSONB report shape.
// Supports both Move-Out Survey and Audience Survey campaign types.

// ── Report envelope (row from research_insights table) ──

export interface ResearchInsightRow {
  id: string;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: ResearchInsightData | AudienceSurveyInsightData;
  total_records_analyzed: number;
  campaign_id?: string;
  campaign_name?: string;
  campaign_type?: string;
  generated_by?: string;
  error_message?: string;
}

// ── Move-Out Survey Data (existing) ──

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

export interface ExecutiveSummary {
  headline: string;
  key_findings: string[];
  recommendations: string[];
  total_cases_analyzed?: number;
  preventable_percent?: number;
  top_reason?: string;
  avg_preventability?: number;
}

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

export interface BlindSpot {
  title: string;
  description: string;
  severity?: 'Critical' | 'High' | 'Medium' | 'Low';
  recommendation?: string;
}

export interface HostAccountabilityFlag {
  issue: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  description?: string;
  frequency?: number;
  host_type?: string;
  recommendation?: string;
}

export interface AgentPerformanceSummary {
  strengths: string[];
  weaknesses: string[];
  coaching_opportunities?: string[];
  top_performers?: string[];
  common_gaps?: string[];
}

export interface EmergingPattern {
  pattern: string;
  status: 'act' | 'investigate' | 'monitor' | 'watch';
  description?: string;
  frequency?: number;
  trend?: 'increasing' | 'stable' | 'decreasing';
  first_seen?: string;
}

// ── Audience Survey Data (new) ──

export interface AudienceSurveyInsightData {
  executive_summary: AudienceSurveySummary;
  platform_breakdown: PlatformItem[];
  ad_awareness: AdAwarenessData;
  content_preferences: ContentPreferencesData;
  first_impressions: FirstImpressionsData;
  audience_segments: AudienceSegment[];
  influencer_insights: InfluencerInsights;
  video_testimonial: VideoTestimonialData;
  recommendations: AudienceRecommendation[];
  cohort_breakdown: CohortItem[];
  _progress?: InsightProgress;
}

export interface AudienceSurveySummary {
  total_responses: number;
  date_range?: string;
  headline: string;
  key_findings: string[];
  top_platform?: string;
  padsplit_ad_awareness_pct?: number;
  video_testimonial_interest_pct?: number;
}

export interface PlatformItem {
  platform: string;
  count: number;
  pct: number;
  is_primary_for?: number;
}

export interface AdAwarenessData {
  seen_standout_ads_pct?: number;
  seen_padsplit_ads_pct?: number;
  top_standout_companies?: Array<{ company: string; count: number }>;
  where_seen_padsplit?: Array<{ platform: string; count: number }>;
  where_expected_padsplit?: Array<{ platform: string; count: number }>;
}

export interface ContentPreferencesData {
  stop_scrolling_triggers?: Array<{ trigger: string; count: number }>;
  click_motivations?: Array<{ motivation: string; count: number }>;
  detail_preferences?: Array<{ detail: string; count: number; pct?: number }>;
  content_type_preferences?: Array<{ type: string; count: number; pct?: number }>;
}

export interface FirstImpressionsData {
  discovery_channels?: Array<{ channel: string; count: number }>;
  impression_distribution?: { positive: number; neutral: number; negative: number; mixed: number };
  top_concerns?: Array<{ concern: string; count: number }>;
  top_interest_drivers?: Array<{ driver: string; count: number }>;
  confusion_points?: Array<{ point: string; count: number }>;
}

export interface AudienceSegment {
  segment: string;
  count: number;
  pct: number;
  key_traits?: string[];
  best_channel?: string;
  content_strategy?: string;
}

export interface InfluencerInsights {
  follows_influencers_pct?: number;
  notable_influencers?: string[];
}

export interface VideoTestimonialData {
  interested_count?: number;
  interested_pct?: number;
  not_interested_count?: number;
}

export interface AudienceRecommendation {
  rank?: number;
  recommendation: string;
  rationale?: string;
  priority?: 'P0' | 'P1' | 'P2';
  channel?: string;
  expected_impact?: string;
  effort?: 'low' | 'medium' | 'high';
}

export interface CohortItem {
  cohort: string;
  count: number;
  pct: number;
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

// ── Campaign type helpers ──

export type CampaignType = 'move_out_survey' | 'audience_survey';

export function isAudienceSurveyData(data: any): data is AudienceSurveyInsightData {
  return data && (data.platform_breakdown || data.ad_awareness || data.audience_segments);
}

// ── KPI derivation helper (Move-Out) ──

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

  const es = data.executive_summary as Record<string, any> | undefined;
  const reasons = data.reason_code_distribution || [];
  const addressableCount = reasons.filter(
    (r) => {
      const a = (r as any).addressability;
      return a === 'Addressable' || a === 'Partially addressable' || a === 'addressable' || a === 'partially_addressable';
    }
  ).length;

  const preventableRaw = es?.preventable_percent ?? es?.addressable_pct ?? es?.preventable_pct ?? es?.preventability_percent;
  const preventablePercent = preventableRaw != null
    ? Math.round(Number(preventableRaw))
    : (reasons.length > 0 ? Math.round((addressableCount / reasons.length) * 100) : 0);

  const avgPrevRaw = es?.avg_preventability ?? es?.avg_preventability_score ?? es?.average_preventability;
  const avgPreventability = avgPrevRaw != null
    ? Number(avgPrevRaw)
    : (reasons.length > 0
        ? reasons.reduce((sum, r) => sum + ((r as any).preventability ?? (r as any).preventability_score ?? 0), 0) / reasons.length
        : 0);

  const totalCasesRaw = es?.total_cases_analyzed ?? es?.total_cases ?? es?.cases_analyzed;

  return {
    totalCases: totalCasesRaw != null
      ? Number(totalCasesRaw)
      : (stats?.processed_records ?? reasons.reduce((sum, r) => sum + r.count, 0)),
    preventablePercent,
    topReasonCode:
      reasons[0]?.code ?? es?.top_reason ?? '—',
    flaggedForReview: stats?.flagged_for_review ?? 0,
    avgPreventability,
  };
}
