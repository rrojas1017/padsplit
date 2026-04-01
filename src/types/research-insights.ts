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

// ── Audience Survey Extraction (per-record) ──

export interface AudienceSurveyExtraction {
  type: 'audience_survey';
  social_media_platforms: string[];
  follows_influencers: boolean;
  influencer_names: string[];
  noticed_standout_ads: boolean;
  standout_ad_details: string;
  padsplit_ad_awareness: 'yes_liked' | 'yes_didnt_like' | 'yes_dont_remember' | 'no';
  expected_ad_platforms: string[];
  ad_attention_triggers: string[];
  padsplit_click_motivators: string[];
  initial_concerns: string[];
  initial_interest_drivers: string[];
  confusion_points: string[];
  ad_detail_preference: 'more_detail' | 'short_simple' | 'depends_on_platform' | 'not_sure';
  content_preferences: string[];
  video_testimonial_interest: boolean | null;
}

// ── Audience Survey Classification (per-record) ──

export interface AudienceSurveyClassification {
  type: 'audience_survey';
  primary_platform_segment: string;
  ad_receptivity: 'high' | 'medium' | 'low';
  brand_awareness_level: 'aware_positive' | 'aware_neutral' | 'aware_negative' | 'unaware';
  content_affinity: string;
  conversion_barrier: string;
}

// ── Audience Survey Insights Report (aggregated) ──

export interface RankedItem {
  item: string;
  count: number;
  percentage: number;
}

export interface AudienceSurveyInsightsReport {
  type: 'audience_survey';
  executive_summary: {
    headline: string;
    key_findings: string[];
    top_recommendation: string;
  };
  kpis: {
    total_responses: number;
    padsplit_ad_awareness_rate: number;
    top_platform: string;
    top_click_motivator: string;
    video_testimonial_interest_rate: number;
  };
  social_media_breakdown: Array<{ platform: string; count: number; percentage: number }>;
  influencer_insights: {
    percentage_following: number;
    notable_influencers: string[];
  };
  ad_awareness: {
    noticed_other_ads_rate: number;
    padsplit_ad_breakdown: {
      yes_liked: number;
      yes_didnt_like: number;
      yes_dont_remember: number;
      no: number;
    };
    expected_ad_platforms: Array<{ platform: string; count: number; percentage: number }>;
  };
  ad_engagement: {
    attention_triggers: RankedItem[];
    click_motivators: RankedItem[];
  };
  first_impressions: {
    initial_concerns: RankedItem[];
    interest_drivers: RankedItem[];
    confusion_points: RankedItem[];
  };
  ad_preferences: {
    detail_preference: {
      more_detail: number;
      short_simple: number;
      depends_on_platform: number;
      not_sure: number;
    };
    content_type_preferences: RankedItem[];
  };
  segments: Array<{
    name: string;
    size: number;
    percentage: number;
    description: string;
    preferred_platforms: string[];
    preferred_content: string[];
    key_motivator: string;
  }>;
  recommendations: Array<{
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
    category: 'creative' | 'targeting' | 'messaging' | 'channel';
    rationale: string;
  }>;
}

// ── Move-Out Insights Report alias (existing ResearchInsightData) ──

export type MoveOutInsightsReport = ResearchInsightData;

// ── Unified Report Wrapper ──

export interface ResearchInsightsReport {
  campaign_type: CampaignType;
  generated_at: string;
  total_records: number;
  report: MoveOutInsightsReport | AudienceSurveyInsightsReport;
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

/** Extract a numeric value from a string like "60-70%", "65%", "6.5", or a plain number. */
function parseNumericish(val: any): number | null {
  if (val == null) return null;
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val !== 'string') return null;
  const cleaned = val.replace(/%/g, '').trim();
  // Handle ranges like "60-70" → take midpoint
  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

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

  // Preventable % — try multiple field names, handle string ranges like "60-70%"
  const preventableRaw = parseNumericish(
    es?.preventable_percent ?? es?.addressable_pct ?? es?.preventable_pct ?? es?.preventability_percent
  );
  const preventablePercent = preventableRaw != null
    ? Math.round(preventableRaw)
    : (reasons.length > 0 ? Math.round((addressableCount / reasons.length) * 100) : 0);

  // Avg preventability — handle string values and missing fields
  const avgPrevRaw = parseNumericish(
    es?.avg_preventability ?? es?.avg_preventability_score ?? es?.average_preventability
  );
  const avgPreventability = avgPrevRaw != null
    ? avgPrevRaw
    : (reasons.length > 0
        ? reasons.reduce((sum, r) => {
            const v = parseNumericish((r as any).preventability ?? (r as any).preventability_score ?? (r as any).avg_preventability);
            return sum + (v ?? 0);
          }, 0) / reasons.length
        : 0);

  const totalCasesRaw = parseNumericish(es?.total_cases_analyzed ?? es?.total_cases ?? es?.cases_analyzed);

  // Top reason — try code, reason_group, category, reason_code
  const topReason = reasons[0]
    ? ((reasons[0] as any).code || (reasons[0] as any).reason_group || (reasons[0] as any).category || (reasons[0] as any).reason_code)
    : null;

  return {
    totalCases: totalCasesRaw != null
      ? Math.round(totalCasesRaw)
      : (stats?.processed_records ?? reasons.reduce((sum, r) => sum + (parseNumericish(r.count) ?? 0), 0)),
    preventablePercent,
    topReasonCode: topReason ?? es?.top_reason ?? '—',
    flaggedForReview: stats?.flagged_for_review ?? 0,
    avgPreventability,
  };
}
