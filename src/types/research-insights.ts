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

// ── Move-Out Survey Data (matches ACTUAL JSONB structure) ──

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

// ACTUAL shape from the AI-generated JSONB:
// executive_summary.headline = long paragraph string
// executive_summary.total_cases = number
// executive_summary.key_findings = string (paragraph, NOT array)
// executive_summary.addressable_pct = string like "60-70%"
// executive_summary.high_regret_pct = string
// executive_summary.host_related_pct = string
// executive_summary.payment_related_pct = string
// executive_summary.life_event_pct = string
// executive_summary.roommate_related_pct = string

export interface ExecutiveSummary {
  headline?: string;
  total_cases?: number;
  key_findings?: string | string[];
  addressable_pct?: string | number;
  high_regret_pct?: string | number;
  host_related_pct?: string | number;
  payment_related_pct?: string | number;
  life_event_pct?: string | number;
  roommate_related_pct?: string | number;
  // Legacy fields for backwards compat
  title?: string;
  key_finding?: string;
  period?: string;
  date_range?: string;
  recommendation_summary?: string;
  urgent_recommendation?: string;
  top_recommendation?: string;
  urgent_quote?: string;
  quantified_impact?: string;
  total_cases_analyzed?: number;
  preventable_percent?: number;
  top_reason?: string;
  avg_preventability?: number;
  avg_preventability_score?: number;
  preventable_pct?: string | number;
}

// ACTUAL shape:
// reason_code_distribution[].reason_group = string
// reason_code_distribution[].count = string ("High", "Medium-High", "Medium", "Low")
// reason_code_distribution[].percentage = string ("25-35%", "10-15%")
// reason_code_distribution[].description = string
export interface ReasonCodeItem {
  reason_group?: string;
  code?: string;
  category?: string;
  count: number | string;
  percentage: number | string;
  description?: string;
  severity?: 'Critical' | 'High' | 'Medium' | 'Low';
  addressability?: string;
  preventability?: number;
  regrettability?: string;
  sub_codes?: string[];
  example_quotes?: string[];
  booking_ids?: string[];
  reason_codes_included?: string[];
}

// ACTUAL shape:
// issue_clusters[].cluster_name = string (e.g. "P0: Host Misconduct...")
// issue_clusters[].description = string
// issue_clusters[].key_quotes = string[]
// issue_clusters[].recommended_action = string
export interface IssueCluster {
  cluster_name?: string;
  name?: string;
  description?: string;
  key_quotes?: string[];
  recommended_action?: string | string[];
  // Legacy
  codes?: string[];
  severity?: string;
  priority?: string;
  root_cause?: string;
  action?: string;
  owner?: string;
  effort?: string;
  case_count?: number;
  quotes?: string[];
  supporting_quotes?: string[];
  representative_quotes?: string[];
  systemic_root_cause?: string;
  cluster_description?: string;
  frequency?: number;
  preventable_pct?: number;
  addressable_pct?: number;
  booking_ids?: string[];
  reason_codes_included?: string[];
  recommended_actions?: string[];
}

// ACTUAL shape:
// top_actions[].action = string (long text starting with priority)
// top_actions[].priority = string ("P0", "P1", "P2")
// top_actions[].quick_win = boolean
export interface TopAction {
  action: string;
  priority: string;
  quick_win?: boolean;
  // Legacy fields (may not exist)
  rank?: number;
  impact?: string;
  owner?: string;
  effort?: string;
  cases?: number;
  timeline?: string;
}

export interface FrictionPoint {
  point: string;
  severity?: string;
  frequency?: number;
  description?: string;
  impact?: string;
}

// ACTUAL shape:
// payment_friction_analysis.summary = string
// payment_friction_analysis.recommendations = string[]
// payment_friction_analysis.issues_identified = string[]
export interface FrictionAnalysis {
  summary?: string;
  recommendations?: string[];
  issues_identified?: string[];
  // Legacy
  friction_points?: FrictionPoint[];
  key_friction_points?: FrictionPoint[];
  key_failures?: string[];
  recommendation?: string;
  stats?: Record<string, any>;
}

export interface BlindSpot {
  blind_spot?: string;
  title?: string;
  description?: string;
  severity?: string;
  recommendation?: string;
}

// ACTUAL shape:
// host_accountability_flags[].flag = string
// host_accountability_flags[].severity = string (e.g. "P0 - Critical, immediate action required.")
export interface HostAccountabilityFlag {
  flag?: string;
  severity?: string;
  // Legacy
  issue?: string;
  priority?: string;
  description?: string;
  frequency?: number;
  host_type?: string;
  recommendation?: string;
  issue_pattern?: string;
  member_count?: number;
  cases?: number;
  quotes?: string[];
  quote?: string;
  recommended_enforcement?: string;
  systemic_fix?: string;
}

// ACTUAL shape:
// agent_performance_summary.strengths = string[]
// agent_performance_summary.areas_for_improvement = string[]
// agent_performance_summary.recommendations = string[]
export interface AgentPerformanceSummary {
  strengths?: string[];
  areas_for_improvement?: string[];
  recommendations?: string[];
  // Legacy
  weaknesses?: string[];
  coaching_opportunities?: string[];
  top_performers?: string[];
  common_gaps?: string[];
}

// ACTUAL shape:
// emerging_patterns[].pattern = string
// emerging_patterns[].description = string
export interface EmergingPattern {
  pattern: string;
  description?: string;
  status?: string;
  frequency?: number;
  trend?: string;
  first_seen?: string;
  evidence?: string;
  quote?: string;
  watch_or_act?: string;
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
  key_findings: string[] | string;
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

export type CampaignType = 'move_out_survey' | 'audience_survey' | `script:${string}`;

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

export interface DerivedKPIs {
  totalCases: number;
  dataErrorCount: number;
  addressablePct: string;
  topReasonCode: string;
  flaggedForReview: number;
  hostRelatedPct: string;
}

export function deriveKPIs(data: any | null, stats: ProcessingStats | null): DerivedKPIs {
  const es = data?.executive_summary as Record<string, any> | undefined;
  const reasons = data?.reason_code_distribution || [];

  // Total cases — prefer stats.processed_records (DB truth) over AI's executive_summary.total_cases (often hallucinated)
  const totalCasesRaw = parseNumericish(es?.total_cases ?? es?.total_cases_analyzed ?? es?.cases_analyzed);
  const totalCases = stats?.processed_records
    ? stats.processed_records
    : (totalCasesRaw != null ? Math.round(totalCasesRaw) : 0);

  // Addressable % — display as-is since it's a string like "60-70%"
  const addressablePct = es?.addressable_pct?.toString() || es?.preventable_pct?.toString() || es?.preventable_percent?.toString() || 'N/A';

  // Top reason — first item from reason_code_distribution
  const firstReason = reasons[0];
  const topReasonCode = firstReason
    ? (firstReason.reason_group || firstReason.code || firstReason.category || firstReason.reason_code || 'N/A')
    : (es?.top_reason || 'N/A');

  // Host related % — display as-is
  const hostRelatedPct = es?.host_related_pct?.toString() || 'N/A';

  return {
    totalCases,
    dataErrorCount: 0, // Will be overridden by live count in the component
    addressablePct,
    topReasonCode,
    flaggedForReview: stats?.flagged_for_review ?? 0,
    hostRelatedPct,
  };
}
