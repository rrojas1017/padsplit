import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cost logging
async function logApiCost(supabase: any, params: {
  service_provider: string;
  service_type: string;
  edge_function: string;
  input_tokens?: number;
  output_tokens?: number;
  metadata?: Record<string, any>;
  triggered_by_user_id?: string;
  is_internal?: boolean;
}) {
  try {
    let cost = 0;
    if (params.service_provider === 'lovable_ai') {
      const model = params.metadata?.model || 'google/gemini-2.5-pro';
      let inputRate = 0.00000125;
      let outputRate = 0.00001;
      if (model.includes('flash')) {
        inputRate = 0.0000003;
        outputRate = 0.0000025;
      }
      cost = ((params.input_tokens || 0) * inputRate) + ((params.output_tokens || 0) * outputRate);
    }
    await supabase.from('api_costs').insert({
      ...params,
      estimated_cost_usd: cost,
      triggered_by_user_id: params.triggered_by_user_id || null,
      is_internal: params.is_internal || false,
    });
    console.log(`[Cost] Logged ${params.service_type}: $${cost.toFixed(6)}`);
  } catch (error) {
    console.error('[Cost] Failed to log cost:', error);
  }
}

const DEFAULT_AGGREGATION_PROMPT = `You are a strategic analyst for PadSplit's Member Experience and Operations leadership. You are reviewing a batch of classified move-out cases to identify systemic patterns, operational blind spots, and prioritized actionable recommendations.

You will receive an array of classification JSONs — each represents one processed move-out record. Your job is to look ACROSS all records to find patterns, clusters, and systemic failures.

Respond with ONLY the JSON object below. No preamble, no markdown, no explanation.

{
  "executive_summary": {
    "total_cases": 0,
    "date_range": "range or 'not specified'",
    "addressable_pct": 0.0,
    "non_addressable_pct": 0.0,
    "partially_addressable_pct": 0.0,
    "avg_preventability_score": 0.0,
    "high_regret_count": 0,
    "high_regret_pct": 0.0,
    "payment_related_pct": 0.0,
    "host_related_pct": 0.0,
    "roommate_related_pct": 0.0,
    "life_event_pct": 0.0,
    "headline": "Single sentence capturing the most important finding."
  },
  "reason_code_distribution": [
    { "code": "Reason code", "count": 0, "pct": 0.0, "avg_preventability": 0.0, "booking_ids": ["booking-uuid-1"], "reason_codes_included": ["GRANULAR_CODE_1"] }
  ],
  "issue_clusters": [
    {
      "cluster_name": "Clear theme name",
      "cluster_description": "2-3 sentences",
      "frequency": 0,
      "pct_of_total": 0.0,
      "reason_codes_included": [],
      "booking_ids": [],
      "severity_distribution": { "critical": 0, "high": 0, "medium": 0, "low": 0 },
      "representative_quotes": [],
      "common_early_warnings": [],
      "systemic_root_cause": "Underlying system/process gap",
      "recommended_action": {
        "action": "Specific implementable recommendation",
        "owner": "Department",
        "priority": "P0 | P1 | P2",
        "expected_impact": "Estimated outcome",
        "effort": "low | medium | high",
        "quick_win": "Immediate small action or null"
      }
    }
  ],
  "emerging_patterns": [
    { "pattern": "Description", "evidence": "Which cases", "frequency": 0, "watch_or_act": "monitor | investigate | act_now" }
  ],
  "operational_blind_spots": [
    {
      "blind_spot": "Something undetected",
      "how_discovered": "Which statements",
      "estimated_prevalence": "How widespread",
      "recommended_detection_method": "Specific method",
      "priority": "P0 | P1 | P2"
    }
  ],
  "host_accountability_flags": [
    {
      "issue_pattern": "Pattern description",
      "frequency": 0,
      "impact_on_retention": "high | medium | low",
      "impact_on_legal_risk": "high | medium | low | none",
      "recommended_enforcement": "Action",
      "systemic_fix": "Process change"
    }
  ],
  "payment_friction_analysis": {
    "payment_related_moveouts": 0,
    "payment_related_pct": 0.0,
    "saveable_with_extension": 0,
    "saveable_pct": 0.0,
    "extension_awareness_gap": false,
    "extension_process_failures": [],
    "miscommunication_incidents": 0,
    "third_party_payment_signals": 0,
    "recommendation": "2-3 sentences"
  },
  "transfer_friction_analysis": {
    "considered_transfer": 0,
    "considered_transfer_pct": 0.0,
    "unaware_of_option": 0,
    "unaware_pct": 0.0,
    "blocked_by_balance": 0,
    "blocked_by_availability": 0,
    "transfer_would_have_retained": 0,
    "recommendation": "2-3 sentences"
  },
  "agent_performance_summary": {
    "total_calls_reviewed": 0,
    "avg_questions_covered": 0,
    "coverage_pct": 0.0,
    "commonly_skipped_sections": [],
    "positive_patterns": [],
    "coaching_opportunities": []
  },
  "top_actions": [
    {
      "rank": 1,
      "action": "Most impactful action",
      "rationale": "Why ranked here",
      "cases_affected": 0,
      "pct_of_batch": 0.0,
      "priority": "P0 | P1 | P2",
      "owner": "Department",
      "effort": "low | medium | high",
      "quick_win": "Immediate action or null"
    }
  ]
}

AGGREGATION RULES:
1. SEMANTIC CLUSTERING — group by actionable root cause, not surface keywords.
2. QUOTES — select for leadership urgency and emotional impact.
3. ROOT CAUSES — go deeper. Ask "why does this keep happening?"
4. PRIORITIZATION: P0 = safety/legal/>40%. P1 = high-regret/20-40%. P2 = moderate.
5. BLIND SPOTS — the most valuable insight is what nobody is tracking.
6. HONESTY — if data shows a serious systemic problem, say so directly.
7. QUICK WINS — for every major recommendation, identify a small fast action.
8. BOOKING IDS — each record has a "_booking_id" field. Include the array of booking IDs in "reason_code_distribution" and "issue_clusters" so the UI can trace back to individual records. Also include "reason_codes_included" listing the granular primary_reason_code values grouped into each category.`;

// ── Audience Survey Aggregation Prompt ──

const AUDIENCE_SURVEY_AGGREGATION_PROMPT = `You are a marketing strategist for PadSplit. You are reviewing a batch of audience survey responses to identify social media patterns, ad awareness levels, content preferences, and marketing recommendations.

You will receive an array of audience survey extraction+classification JSONs. Your job is to aggregate across all responses to find patterns and actionable marketing insights.

Respond with ONLY the JSON object below. No preamble, no markdown, no explanation.

{
  "executive_summary": {
    "total_responses": 0,
    "date_range": "range or 'not specified'",
    "headline": "Single sentence capturing the most important marketing finding.",
    "key_findings": ["finding 1", "finding 2", "finding 3"],
    "top_platform": "Most used platform",
    "padsplit_ad_awareness_pct": 0.0,
    "video_testimonial_interest_pct": 0.0
  },
  "platform_breakdown": [
    { "platform": "TikTok", "count": 0, "pct": 0.0, "is_primary_for": 0 }
  ],
  "ad_awareness": {
    "seen_standout_ads_pct": 0.0,
    "seen_padsplit_ads_pct": 0.0,
    "top_standout_companies": [{ "company": "name", "count": 0 }],
    "where_seen_padsplit": [{ "platform": "name", "count": 0 }],
    "where_expected_padsplit": [{ "platform": "name", "count": 0 }]
  },
  "content_preferences": {
    "stop_scrolling_triggers": [{ "trigger": "description", "count": 0 }],
    "click_motivations": [{ "motivation": "description", "count": 0 }],
    "detail_preferences": [{ "detail": "price | location | photos | reviews | move-in process", "count": 0, "pct": 0.0 }],
    "content_type_preferences": [{ "type": "short_video | testimonial | carousel | static_image", "count": 0, "pct": 0.0 }]
  },
  "first_impressions": {
    "discovery_channels": [{ "channel": "how they heard", "count": 0 }],
    "impression_distribution": { "positive": 0, "neutral": 0, "negative": 0, "mixed": 0 },
    "top_concerns": [{ "concern": "description", "count": 0 }],
    "top_interest_drivers": [{ "driver": "description", "count": 0 }],
    "confusion_points": [{ "point": "description", "count": 0 }]
  },
  "audience_segments": [
    {
      "segment": "social_media_heavy | ad_responsive | word_of_mouth | price_driven | research_heavy | passive_browser",
      "count": 0,
      "pct": 0.0,
      "key_traits": ["trait 1", "trait 2"],
      "best_channel": "recommended platform",
      "content_strategy": "1-2 sentences"
    }
  ],
  "influencer_insights": {
    "follows_influencers_pct": 0.0,
    "notable_influencers": ["name if frequently mentioned"]
  },
  "video_testimonial": {
    "interested_count": 0,
    "interested_pct": 0.0,
    "not_interested_count": 0
  },
  "recommendations": [
    {
      "rank": 1,
      "recommendation": "Specific marketing action",
      "rationale": "Why this matters",
      "priority": "P0 | P1 | P2",
      "channel": "Which platform/channel",
      "expected_impact": "Estimated outcome",
      "effort": "low | medium | high"
    }
  ],
  "cohort_breakdown": [
    { "cohort": "active_member | approved_not_booked | application_started | account_created", "count": 0, "pct": 0.0 }
  ]
}

AGGREGATION RULES:
1. COUNT EVERYTHING — aggregate exact counts and percentages for all multiple-choice responses.
2. RANK by frequency — most popular platforms, most common preferences, etc.
3. SEGMENT ANALYSIS — identify distinct audience segments and their marketing implications.
4. ACTIONABLE RECOMMENDATIONS — every recommendation should be specific enough for a marketing team to execute.
5. CHANNEL MAPPING — connect insights to specific marketing channels and content strategies.
6. QUOTES — include memorable or insightful quotes from respondents.
7. CROSS-REFERENCE — look for patterns between platform usage and ad preferences.`;


// Normalize a single chunk result to enforce canonical shape.
// AI output is untrusted — any field may be missing, wrong type, or string instead of object.
function normalizeChunkResult(raw: any): any {
  if (!raw || typeof raw !== 'object') {
    console.warn('[Normalize] Chunk result is not an object, creating fallback');
    return createEmptyChunkResult();
  }

  // Deep clone to avoid mutating the original and ensure all nested values are plain objects
  let result: any;
  try {
    result = JSON.parse(JSON.stringify(raw));
  } catch {
    console.warn('[Normalize] Failed to deep clone chunk, using shallow copy');
    result = { ...raw };
  }

  // executive_summary: must be an object — forcefully wrap strings
  if (!result.executive_summary || typeof result.executive_summary !== 'object' || Array.isArray(result.executive_summary)) {
    const headline = typeof result.executive_summary === 'string' ? result.executive_summary : 'Analysis complete';
    result.executive_summary = {
      headline,
      key_findings: typeof result.executive_summary === 'string' ? result.executive_summary : '',
      total_cases: 0,
      date_range: 'not specified',
      addressable_pct: 0, non_addressable_pct: 0, partially_addressable_pct: 0,
      avg_preventability_score: 0, high_regret_count: 0, high_regret_pct: 0,
      payment_related_pct: 0, host_related_pct: 0, roommate_related_pct: 0, life_event_pct: 0,
    };
  }

  // Ensure all expected array fields exist and normalize items
  const arrayKeys = ['reason_code_distribution', 'issue_clusters', 'emerging_patterns', 'operational_blind_spots', 'host_accountability_flags'];

  // reason_code_distribution may come as:
  // Format A: array of { code, count, pct }
  // Format B: object { total_cases, preventable_churn, by_category: [...] }
  // Format C: key-value map { "Payment": 5, "Host": 3 } or { "Payment": { count: 5, ... } }
  // Format D: string (just wrap as empty)
  if (typeof result.reason_code_distribution === 'string') {
    result.reason_code_distribution = [];
  } else if (result.reason_code_distribution && typeof result.reason_code_distribution === 'object' && !Array.isArray(result.reason_code_distribution)) {
    const rcd = result.reason_code_distribution;
    // Format B: has by_category array — extract it
    if (Array.isArray(rcd.by_category)) {
      const total = rcd.total_cases || rcd.by_category.reduce((s: number, c: any) => s + (c.count || 0), 0);
      result.reason_code_distribution = rcd.by_category.map((d: any) => ({
        code: d.category || d.code || 'Unknown',
        reason_group: d.category || d.code || 'Unknown',
        category: d.category || d.code || 'Unknown',
        count: d.count || 0,
        pct: d.percentage || (total > 0 ? ((d.count || 0) / total * 100) : 0),
        percentage: d.percentage || (total > 0 ? ((d.count || 0) / total * 100) : 0),
        description: d.description || d.details || '',
        booking_ids: d.booking_ids || [],
        reason_codes_included: d.reason_codes_included || [],
      }));
      // Preserve top-level stats in executive_summary if available
      if (typeof rcd.total_cases === 'number' && result.executive_summary) {
        result.executive_summary.total_cases = result.executive_summary.total_cases || rcd.total_cases;
      }
    } else if (Array.isArray(rcd.distribution)) {
      // Format B variant with distribution key
      const total = rcd.total_cases || rcd.distribution.reduce((s: number, c: any) => s + (c.count || 0), 0);
      result.reason_code_distribution = rcd.distribution.map((d: any) => ({
        code: d.reason_group || d.code || 'Unknown',
        reason_group: d.reason_group || d.code || 'Unknown',
        category: d.reason_group || d.code || 'Unknown',
        count: d.count || 0,
        pct: d.percentage || (total > 0 ? ((d.count || 0) / total * 100) : 0),
        percentage: d.percentage || (total > 0 ? ((d.count || 0) / total * 100) : 0),
        description: d.details || d.description || '',
        booking_ids: d.booking_ids || [],
        reason_codes_included: d.reason_codes_included || [],
      }));
    } else {
      // Format C: plain key-value map — filter out metadata keys
      const metadataKeys = new Set(['total_cases', 'preventable_churn', 'unpreventable_churn', 'methodology']);
      const extractCount = (v: any): number => {
        if (typeof v === 'number') return v;
        if (v && typeof v === 'object') {
          if (typeof v.count === 'number') return v.count;
          if (typeof v.total === 'number') return v.total;
          if (typeof v.frequency === 'number') return v.frequency;
        }
        return 0;
      };
      const entries = Object.entries(rcd).filter(([key]) => !metadataKeys.has(key));
      const counts = entries.map(([key, val]) => ({ key, count: extractCount(val), raw: val }));
      const total = counts.reduce((s, c) => s + c.count, 0);
      result.reason_code_distribution = counts.map(({ key, count, raw }) => ({
        code: key, reason_group: key, category: key,
        count,
        pct: total > 0 ? (count / total * 100) : 0,
        percentage: total > 0 ? (count / total * 100) : 0,
        description: raw && typeof raw === 'object' ? (raw.description || raw.details || '') : '',
        booking_ids: raw && typeof raw === 'object' ? (raw.booking_ids || []) : [],
        reason_codes_included: raw && typeof raw === 'object' ? (raw.reason_codes_included || []) : [],
      }));
    }
  }

  for (const key of arrayKeys) {
    if (!Array.isArray(result[key])) { result[key] = []; continue; }
    // Normalize individual items: strings → objects
    result[key] = result[key].map((item: any) => {
      if (typeof item !== 'string') return item;
      switch (key) {
        case 'operational_blind_spots': return { blind_spot: item };
        case 'host_accountability_flags': return { flag: item };
        case 'emerging_patterns': return { pattern: item };
        case 'issue_clusters': return { cluster: item, description: item };
        default: return { value: item };
      }
    });
  }

  // top_actions: can be array or object with priority-keyed arrays
  if (result.top_actions && typeof result.top_actions === 'object' && !Array.isArray(result.top_actions)) {
    // Object form — keep as-is (plan.md schema)
  } else if (!Array.isArray(result.top_actions)) {
    result.top_actions = [];
  }

  // payment_friction_analysis: must be object
  if (!result.payment_friction_analysis || typeof result.payment_friction_analysis !== 'object') {
    result.payment_friction_analysis = { payment_related_moveouts: 0, recommendation: '' };
  }

  // transfer_friction_analysis: must be object
  if (!result.transfer_friction_analysis || typeof result.transfer_friction_analysis !== 'object') {
    result.transfer_friction_analysis = { considered_transfer: 0, recommendation: '' };
  }

  // agent_performance_summary: must be object
  if (!result.agent_performance_summary || typeof result.agent_performance_summary !== 'object') {
    result.agent_performance_summary = { total_calls_reviewed: 0, commonly_skipped_sections: [], positive_patterns: [], coaching_opportunities: [] };
  }

  return result;
}

function createEmptyChunkResult(): any {
  return {
    executive_summary: { headline: 'No data', total_cases: 0, date_range: 'not specified' },
    reason_code_distribution: [],
    issue_clusters: [],
    emerging_patterns: [],
    operational_blind_spots: [],
    host_accountability_flags: [],
    top_actions: [],
    payment_friction_analysis: { payment_related_moveouts: 0, recommendation: '' },
    transfer_friction_analysis: { considered_transfer: 0, recommendation: '' },
    agent_performance_summary: { total_calls_reviewed: 0, commonly_skipped_sections: [], positive_patterns: [], coaching_opportunities: [] },
  };
}

// ── Audience Survey normalization ──

function normalizeAudienceChunkResult(raw: any): any {
  if (!raw || typeof raw !== 'object') return createEmptyAudienceChunkResult();
  let result: any;
  try { result = JSON.parse(JSON.stringify(raw)); } catch { result = { ...raw }; }

  // executive_summary
  if (!result.executive_summary || typeof result.executive_summary !== 'object') {
    result.executive_summary = { headline: typeof result.executive_summary === 'string' ? result.executive_summary : 'Analysis complete', total_responses: 0, key_findings: [] };
  }
  if (!Array.isArray(result.executive_summary.key_findings)) result.executive_summary.key_findings = [];

  // Arrays
  for (const key of ['platform_breakdown', 'audience_segments', 'recommendations', 'cohort_breakdown']) {
    if (!Array.isArray(result[key])) result[key] = [];
  }

  // Objects
  if (!result.ad_awareness || typeof result.ad_awareness !== 'object') result.ad_awareness = {};
  if (!result.content_preferences || typeof result.content_preferences !== 'object') result.content_preferences = {};
  if (!result.first_impressions || typeof result.first_impressions !== 'object') result.first_impressions = {};
  if (!result.influencer_insights || typeof result.influencer_insights !== 'object') result.influencer_insights = {};
  if (!result.video_testimonial || typeof result.video_testimonial !== 'object') result.video_testimonial = {};

  // Ensure sub-arrays exist
  for (const key of ['top_standout_companies', 'where_seen_padsplit', 'where_expected_padsplit']) {
    if (!Array.isArray(result.ad_awareness[key])) result.ad_awareness[key] = [];
  }
  for (const key of ['stop_scrolling_triggers', 'click_motivations', 'detail_preferences', 'content_type_preferences']) {
    if (!Array.isArray(result.content_preferences[key])) result.content_preferences[key] = [];
  }
  for (const key of ['discovery_channels', 'top_concerns', 'top_interest_drivers', 'confusion_points']) {
    if (!Array.isArray(result.first_impressions[key])) result.first_impressions[key] = [];
  }
  if (!result.first_impressions.impression_distribution || typeof result.first_impressions.impression_distribution !== 'object') {
    result.first_impressions.impression_distribution = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  }
  if (!Array.isArray(result.influencer_insights.notable_influencers)) result.influencer_insights.notable_influencers = [];

  return result;
}

function createEmptyAudienceChunkResult(): any {
  return {
    executive_summary: { headline: 'No data', total_responses: 0, key_findings: [] },
    platform_breakdown: [],
    ad_awareness: { seen_standout_ads_pct: 0, seen_padsplit_ads_pct: 0, top_standout_companies: [], where_seen_padsplit: [], where_expected_padsplit: [] },
    content_preferences: { stop_scrolling_triggers: [], click_motivations: [], detail_preferences: [], content_type_preferences: [] },
    first_impressions: { discovery_channels: [], impression_distribution: { positive: 0, neutral: 0, negative: 0, mixed: 0 }, top_concerns: [], top_interest_drivers: [], confusion_points: [] },
    audience_segments: [],
    influencer_insights: { follows_influencers_pct: 0, notable_influencers: [] },
    video_testimonial: { interested_count: 0, interested_pct: 0, not_interested_count: 0 },
    recommendations: [],
    cohort_breakdown: [],
  };
}

// ── Audience Survey programmatic merge ──

function programmaticMergeAudience(chunkResults: any[]): any {
  const normalized = chunkResults.map(c => normalizeAudienceChunkResult(c));
  if (normalized.length === 0) return createEmptyAudienceChunkResult();
  if (normalized.length === 1) return normalized[0];

  const base = JSON.parse(JSON.stringify(normalized[0]));

  // Merge executive_summary
  const summaries = normalized.map(c => c.executive_summary).filter((e: any) => e && typeof e === 'object');
  base.executive_summary.total_responses = summaries.reduce((s: number, e: any) => s + (e.total_responses || 0), 0);
  base.executive_summary.key_findings = [...new Set(summaries.flatMap((e: any) => e.key_findings || []))].slice(0, 5);

  // Merge counted arrays by merging on a key field
  const mergeCountedArray = (key: string, nameField: string): any[] => {
    const all = normalized.flatMap(c => Array.isArray(c[key]) ? c[key] : []);
    const map = new Map<string, any>();
    for (const item of all) {
      const name = item[nameField] || 'Unknown';
      const existing = map.get(name);
      if (existing) {
        existing.count = (existing.count || 0) + (item.count || 0);
      } else {
        map.set(name, { ...item });
      }
    }
    const merged = Array.from(map.values());
    const total = merged.reduce((s, i) => s + (i.count || 0), 0);
    for (const item of merged) { item.pct = total > 0 ? (item.count / total * 100) : 0; }
    return merged.sort((a, b) => (b.count || 0) - (a.count || 0));
  };

  base.platform_breakdown = mergeCountedArray('platform_breakdown', 'platform');
  base.cohort_breakdown = mergeCountedArray('cohort_breakdown', 'cohort');

  // Merge nested counted arrays
  const mergeNestedCounted = (parentKey: string, childKey: string, nameField: string): any[] => {
    const all = normalized.flatMap(c => c[parentKey] && Array.isArray(c[parentKey][childKey]) ? c[parentKey][childKey] : []);
    const map = new Map<string, any>();
    for (const item of all) {
      const name = item[nameField] || 'Unknown';
      const existing = map.get(name);
      if (existing) { existing.count = (existing.count || 0) + (item.count || 0); }
      else { map.set(name, { ...item }); }
    }
    return Array.from(map.values()).sort((a, b) => (b.count || 0) - (a.count || 0));
  };

  // ad_awareness
  base.ad_awareness.top_standout_companies = mergeNestedCounted('ad_awareness', 'top_standout_companies', 'company');
  base.ad_awareness.where_seen_padsplit = mergeNestedCounted('ad_awareness', 'where_seen_padsplit', 'platform');
  base.ad_awareness.where_expected_padsplit = mergeNestedCounted('ad_awareness', 'where_expected_padsplit', 'platform');
  const adPcts = normalized.map(c => c.ad_awareness).filter(a => a);
  base.ad_awareness.seen_standout_ads_pct = adPcts.reduce((s: number, a: any) => s + (a.seen_standout_ads_pct || 0), 0) / (adPcts.length || 1);
  base.ad_awareness.seen_padsplit_ads_pct = adPcts.reduce((s: number, a: any) => s + (a.seen_padsplit_ads_pct || 0), 0) / (adPcts.length || 1);

  // content_preferences
  base.content_preferences.stop_scrolling_triggers = mergeNestedCounted('content_preferences', 'stop_scrolling_triggers', 'trigger');
  base.content_preferences.click_motivations = mergeNestedCounted('content_preferences', 'click_motivations', 'motivation');
  base.content_preferences.detail_preferences = mergeNestedCounted('content_preferences', 'detail_preferences', 'detail');
  base.content_preferences.content_type_preferences = mergeNestedCounted('content_preferences', 'content_type_preferences', 'type');

  // first_impressions
  base.first_impressions.discovery_channels = mergeNestedCounted('first_impressions', 'discovery_channels', 'channel');
  base.first_impressions.top_concerns = mergeNestedCounted('first_impressions', 'top_concerns', 'concern');
  base.first_impressions.top_interest_drivers = mergeNestedCounted('first_impressions', 'top_interest_drivers', 'driver');
  base.first_impressions.confusion_points = mergeNestedCounted('first_impressions', 'confusion_points', 'point');
  // impression_distribution: sum
  const dists = normalized.map(c => c.first_impressions?.impression_distribution).filter(d => d);
  base.first_impressions.impression_distribution = {
    positive: dists.reduce((s: number, d: any) => s + (d.positive || 0), 0),
    neutral: dists.reduce((s: number, d: any) => s + (d.neutral || 0), 0),
    negative: dists.reduce((s: number, d: any) => s + (d.negative || 0), 0),
    mixed: dists.reduce((s: number, d: any) => s + (d.mixed || 0), 0),
  };

  // influencer_insights
  base.influencer_insights.notable_influencers = [...new Set(normalized.flatMap(c => c.influencer_insights?.notable_influencers || []))];
  const infPcts = normalized.map(c => c.influencer_insights?.follows_influencers_pct).filter((v: any) => typeof v === 'number');
  base.influencer_insights.follows_influencers_pct = infPcts.length > 0 ? infPcts.reduce((a: number, b: number) => a + b, 0) / infPcts.length : 0;

  // video_testimonial: sum
  const vids = normalized.map(c => c.video_testimonial).filter(v => v);
  base.video_testimonial.interested_count = vids.reduce((s: number, v: any) => s + (v.interested_count || 0), 0);
  base.video_testimonial.not_interested_count = vids.reduce((s: number, v: any) => s + (v.not_interested_count || 0), 0);
  const totalVid = base.video_testimonial.interested_count + base.video_testimonial.not_interested_count;
  base.video_testimonial.interested_pct = totalVid > 0 ? (base.video_testimonial.interested_count / totalVid * 100) : 0;

  // audience_segments & recommendations: concat and deduplicate by name
  base.audience_segments = normalized.flatMap(c => c.audience_segments || []);
  base.recommendations = normalized.flatMap(c => c.recommendations || []).slice(0, 10);

  return base;
}

// Programmatic merge fallback: combines normalized chunk results
function programmaticMerge(chunkResults: any[]): any {
  // Normalize all chunks first
  const normalized = chunkResults.map(c => normalizeChunkResult(c));
  
  if (normalized.length === 0) return createEmptyChunkResult();
  if (normalized.length === 1) return normalized[0];

  const base = JSON.parse(JSON.stringify(normalized[0]));

  // Merge executive_summary — ensure it's an object before assigning
  if (!base.executive_summary || typeof base.executive_summary !== 'object') {
    base.executive_summary = { headline: '', total_cases: 0, date_range: 'not specified' };
  }
  const summaries = normalized.map(c => c.executive_summary).filter((e: any) => e && typeof e === 'object');
  const totalCases = summaries.reduce((s: number, e: any) => s + (typeof e.total_cases === 'number' ? e.total_cases : 0), 0);
  base.executive_summary.total_cases = totalCases;
  for (const pctKey of ['addressable_pct', 'non_addressable_pct', 'partially_addressable_pct', 'avg_preventability_score', 'high_regret_pct', 'payment_related_pct', 'host_related_pct', 'roommate_related_pct', 'life_event_pct']) {
    const vals = summaries.map((e: any) => e[pctKey]).filter((v: any) => typeof v === 'number');
    if (vals.length > 0) base.executive_summary[pctKey] = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
  }
  base.executive_summary.high_regret_count = summaries.reduce((s: number, e: any) => s + (typeof e.high_regret_count === 'number' ? e.high_regret_count : 0), 0);

  // Merge array fields
  const arrayKeys = ['issue_clusters', 'emerging_patterns', 'operational_blind_spots', 'host_accountability_flags'];
  for (const key of arrayKeys) {
    base[key] = normalized.flatMap(c => Array.isArray(c[key]) ? c[key] : []);
  }

  // Merge reason_code_distribution with deduplication
  const allReasonCodes = normalized.flatMap(c => Array.isArray(c.reason_code_distribution) ? c.reason_code_distribution : []);
  const reasonMap = new Map<string, any>();
  
  // Normalize key: lowercase, trim, convert ENUM_STYLE to readable, collapse synonyms
  const normalizeReasonKey = (code: string): string => {
    let key = code.trim();
    // Convert ENUM_STYLE_CODES to readable: MEMBER_FINANCIAL_HARDSHIP → member financial hardship
    if (/^[A-Z_]+$/.test(key)) {
      key = key.toLowerCase().replace(/_/g, ' ');
    }
    key = key.toLowerCase();
    // Collapse "external circumstances - X" to just "X"
    key = key.replace(/^external circumstances\s*[-–—:]\s*/i, '');
    // Collapse "personal reasons - X" to just "X"
    key = key.replace(/^personal reasons\s*[-–—:]\s*/i, '');
    return key;
  };

  for (const item of allReasonCodes) {
    const rawCode = item.code || item.category || item.reason_group || 'Unknown';
    const normalizedKey = normalizeReasonKey(rawCode);
    const existing = reasonMap.get(normalizedKey);
    if (existing) {
      existing.count += (item.count || 0);
      if (Array.isArray(item.booking_ids)) existing.booking_ids.push(...item.booking_ids);
      if (Array.isArray(item.reason_codes_included)) existing.reason_codes_included.push(...item.reason_codes_included);
    } else {
      // Use the most readable version of the name (prefer original casing over lowercased)
      reasonMap.set(normalizedKey, {
        code: rawCode,
        reason_group: rawCode,
        category: rawCode,
        count: item.count || 0,
        description: item.description || item.details || '',
        booking_ids: Array.isArray(item.booking_ids) ? [...item.booking_ids] : [],
        reason_codes_included: Array.isArray(item.reason_codes_included) ? [...item.reason_codes_included] : [],
      });
    }
  }

  // Recalculate percentages, sort, and cap at top 20 + "Other"
  const mergedReasons = Array.from(reasonMap.values());
  const totalCount = mergedReasons.reduce((s, r) => s + r.count, 0);
  for (const r of mergedReasons) {
    r.pct = totalCount > 0 ? (r.count / totalCount * 100) : 0;
    r.percentage = r.pct;
    // Deduplicate arrays
    r.booking_ids = [...new Set(r.booking_ids)];
    r.reason_codes_included = [...new Set(r.reason_codes_included)];
  }
  mergedReasons.sort((a, b) => b.count - a.count);

  const MAX_REASON_CODES = 20;
  if (mergedReasons.length > MAX_REASON_CODES) {
    const top = mergedReasons.slice(0, MAX_REASON_CODES);
    const rest = mergedReasons.slice(MAX_REASON_CODES);
    const otherCount = rest.reduce((s, r) => s + r.count, 0);
    top.push({
      code: `Other (${rest.length} categories)`,
      reason_group: `Other (${rest.length} categories)`,
      category: `Other (${rest.length} categories)`,
      count: otherCount,
      pct: totalCount > 0 ? (otherCount / totalCount * 100) : 0,
      percentage: totalCount > 0 ? (otherCount / totalCount * 100) : 0,
      description: `Aggregated from ${rest.length} smaller categories`,
      booking_ids: rest.flatMap(r => r.booking_ids),
      reason_codes_included: rest.flatMap(r => r.reason_codes_included),
    });
    base.reason_code_distribution = top;
  } else {
    base.reason_code_distribution = mergedReasons;
  }

  // Merge top_actions — handle both array and object forms
  const allTopActions: any[] = [];
  for (const c of normalized) {
    if (Array.isArray(c.top_actions)) {
      allTopActions.push(...c.top_actions);
    } else if (c.top_actions && typeof c.top_actions === 'object') {
      // Object form with priority keys
      for (const key of Object.keys(c.top_actions)) {
        if (Array.isArray(c.top_actions[key])) allTopActions.push(...c.top_actions[key]);
      }
    }
  }
  if (allTopActions.length > 0) {
    allTopActions.sort((a: any, b: any) => (b.cases_affected || 0) - (a.cases_affected || 0));
    base.top_actions = allTopActions.slice(0, 10).map((a: any, i: number) => ({ ...a, rank: i + 1 }));
  }

  // Merge agent_performance_summary
  const perfs = normalized.map(c => c.agent_performance_summary).filter(p => p && typeof p === 'object');
  if (perfs.length > 0) {
    base.agent_performance_summary.total_calls_reviewed = perfs.reduce((s: number, p: any) => s + (typeof p.total_calls_reviewed === 'number' ? p.total_calls_reviewed : 0), 0);
    const avgQs = perfs.map((p: any) => p.avg_questions_covered).filter((v: any) => typeof v === 'number');
    if (avgQs.length) base.agent_performance_summary.avg_questions_covered = avgQs.reduce((a: number, b: number) => a + b, 0) / avgQs.length;
    base.agent_performance_summary.commonly_skipped_sections = [...new Set(perfs.flatMap((p: any) => Array.isArray(p.commonly_skipped_sections) ? p.commonly_skipped_sections : []))];
    base.agent_performance_summary.positive_patterns = [...new Set(perfs.flatMap((p: any) => Array.isArray(p.positive_patterns) ? p.positive_patterns : []))];
    base.agent_performance_summary.coaching_opportunities = [...new Set(perfs.flatMap((p: any) => Array.isArray(p.coaching_opportunities) ? p.coaching_opportunities : []))];
  }

  return base;
}

async function callLovableAI(
  apiKey: string,
  model: string,
  temperature: number,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 16384,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return {
    content: result.choices?.[0]?.message?.content || '',
    inputTokens: result.usage?.prompt_tokens || Math.ceil(userPrompt.length / 4),
    outputTokens: result.usage?.completion_tokens || Math.ceil((result.choices?.[0]?.message?.content || '').length / 4),
  };
}

// ── Self-chaining: process ONE chunk, store result, self-invoke for next ──

async function processOneChunk(
  supabaseUrl: string,
  supabaseServiceKey: string,
  lovableApiKey: string,
  insightId: string,
  chunkIndex: number,
  totalChunks: number,
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Load the insight record to get _meta and _chunks
    const { data: insight, error: loadErr } = await supabase
      .from('research_insights')
      .select('data, status')
      .eq('id', insightId)
      .single();

    if (loadErr || !insight) {
      console.error(`[Chain] Failed to load insight ${insightId}:`, loadErr?.message);
      return;
    }

    if (insight.status !== 'processing') {
      console.log(`[Chain] Insight ${insightId} is no longer processing (status: ${insight.status}), stopping.`);
      return;
    }

    const meta = (insight.data as any)?._meta;
    if (!meta) {
      console.error(`[Chain] No _meta found in insight ${insightId}`);
      await supabase.from('research_insights').update({ status: 'failed', error_message: 'Missing _meta in data' }).eq('id', insightId);
      return;
    }

    const { chunks, dateRange, model, temperature, systemPrompt, triggeredByUserId } = meta;
    const existingChunkResults: any[] = (insight.data as any)?._chunks || [];

    const chunk = chunks[chunkIndex];
    if (!chunk) {
      console.error(`[Chain] Chunk ${chunkIndex} not found in _meta`);
      return;
    }

    console.log(`[Chain] Processing chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} records) for insight ${insightId}`);

    // Update progress
    await supabase.from('research_insights').update({
      data: {
        ...(insight.data as any),
        _progress: { totalChunks, completedChunks: chunkIndex, totalRecords: meta.totalRecords, currentPhase: 'analyzing' },
      }
    }).eq('id', insightId);

    // Process this chunk
    const isMoveOut = meta.campaignType !== 'audience_survey';
    const batchLabel = isMoveOut ? 'classified move-out records' : 'audience survey responses';
    const userMsg = `Date range: ${dateRange}\nBatch ${chunkIndex + 1} of ${totalChunks}\n\nHere are ${chunk.length} ${batchLabel}:\n\n${JSON.stringify(chunk)}`;
    
    const chunkTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Chunk ${chunkIndex + 1} timed out after 60s`)), 60000)
    );
    const result = await Promise.race([
      callLovableAI(lovableApiKey, model, temperature, systemPrompt, userMsg),
      chunkTimeout,
    ]);

    let parsed: any = null;
    const rawContent = result.content?.trim() || '';

    if (rawContent.length > 100) {
      try {
        const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[1].trim() : rawContent);
      } catch {
        console.warn(`[Chain] Chunk ${chunkIndex + 1} parse failed (${rawContent.length} chars), retrying...`);
      }
    }

    if (!parsed) {
      try {
        const retryTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Chunk ${chunkIndex + 1} retry timed out`)), 60000)
        );
        const retryResult = await Promise.race([
          callLovableAI(lovableApiKey, model, temperature,
            systemPrompt + '\n\nCRITICAL: Respond ONLY with raw JSON. No markdown, no code fences, no explanation.',
            userMsg
          ),
          retryTimeout,
        ]);
        const retryContent = retryResult.content?.trim() || '';
        const retryMatch = retryContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        parsed = JSON.parse(retryMatch ? retryMatch[1].trim() : retryContent);
        console.log(`[Chain] Chunk ${chunkIndex + 1} retry succeeded`);

        await logApiCost(supabase, {
          service_provider: 'lovable_ai', service_type: 'research_aggregation',
          edge_function: 'generate-research-insights',
          input_tokens: retryResult.inputTokens, output_tokens: retryResult.outputTokens,
          metadata: { model, prompt: 'C_retry', chunk: chunkIndex + 1, totalChunks },
          triggered_by_user_id: triggeredByUserId || undefined, is_internal: false,
        });
      } catch (retryErr) {
        console.error(`[Chain] Chunk ${chunkIndex + 1} retry also failed: ${retryErr instanceof Error ? retryErr.message : retryErr}`);
      }
    }

    await logApiCost(supabase, {
      service_provider: 'lovable_ai', service_type: 'research_aggregation',
      edge_function: 'generate-research-insights',
      input_tokens: result.inputTokens, output_tokens: result.outputTokens,
      metadata: { model, prompt: 'C', chunk: chunkIndex + 1, totalChunks },
      triggered_by_user_id: triggeredByUserId || undefined, is_internal: false,
    });

    const newChunkResults = [...existingChunkResults];
    if (parsed) {
      const normalized = normalizeChunkResult(parsed);
      newChunkResults.push(normalized);
      console.log(`[Chain] Chunk ${chunkIndex + 1} normalized and stored`);
    }

    const isLastChunk = chunkIndex >= totalChunks - 1;

    if (!isLastChunk) {
      // Store chunk result and progress, then self-invoke for next chunk
      await supabase.from('research_insights').update({
        data: {
          ...(insight.data as any),
          _chunks: newChunkResults,
          _progress: { totalChunks, completedChunks: chunkIndex + 1, totalRecords: meta.totalRecords, currentPhase: 'analyzing' },
        }
      }).eq('id', insightId);

      console.log(`[Chain] Chunk ${chunkIndex + 1} done, self-invoking for chunk ${chunkIndex + 2}`);
      await selfInvokeResume(supabaseUrl, supabaseServiceKey, insightId, chunkIndex + 1, totalChunks);
    } else {
      // Last chunk — synthesize
      console.log(`[Chain] All ${totalChunks} chunks done (${newChunkResults.length} parsed), synthesizing...`);

      await supabase.from('research_insights').update({
        data: {
          ...(insight.data as any),
          _chunks: newChunkResults,
          _progress: { totalChunks, completedChunks: totalChunks, totalRecords: meta.totalRecords, currentPhase: 'synthesizing' },
        }
      }).eq('id', insightId);

      if (newChunkResults.length === 0) {
        await supabase.from('research_insights').update({
          status: 'failed', error_message: 'All chunk analyses returned invalid JSON — the AI model may be overloaded. Please retry.'
        }).eq('id', insightId);
        return;
      }

      let finalResult: any;
      if (newChunkResults.length === 1) {
        finalResult = normalizeChunkResult(newChunkResults[0]);
      } else {
        // Synthesize
        const synthesisModel = 'google/gemini-2.5-flash';
        try {
          const synthTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('synthesis_timeout')), 90000)
          );
          const synthesisResult = await Promise.race([
            callLovableAI(lovableApiKey, synthesisModel, temperature, systemPrompt,
              `Date range: ${dateRange}\n\nYou previously analyzed ${meta.totalRecords} records in ${newChunkResults.length} batches. Synthesize these batch results into a single unified insight report:\n\n${JSON.stringify(newChunkResults, null, 2)}`
            ),
            synthTimeout,
          ]);

          try {
            const jsonMatch = synthesisResult.content.match(/```(?:json)?\s*([\s\S]*?)```/);
            const parsed = JSON.parse(jsonMatch ? jsonMatch[1].trim() : synthesisResult.content.trim());
            finalResult = normalizeChunkResult(parsed);
          } catch {
            console.warn('[Chain] Synthesis parse failed, using programmatic merge');
            try {
              finalResult = programmaticMerge(newChunkResults);
            } catch (mergeErr) {
              console.error('[Chain] Programmatic merge also failed:', mergeErr);
              finalResult = normalizeChunkResult(newChunkResults[0]);
            }
          }

          await logApiCost(supabase, {
            service_provider: 'lovable_ai', service_type: 'research_aggregation_synthesis',
            edge_function: 'generate-research-insights',
            input_tokens: synthesisResult.inputTokens, output_tokens: synthesisResult.outputTokens,
            metadata: { model: synthesisModel, prompt: 'C_synthesis' },
            triggered_by_user_id: triggeredByUserId || undefined, is_internal: false,
          });
        } catch (synthErr: any) {
          console.warn(`[Chain] Synthesis error: ${synthErr?.message}, using programmatic merge`);
          try {
            finalResult = programmaticMerge(newChunkResults);
          } catch (mergeErr) {
            console.error('[Chain] Programmatic merge also failed:', mergeErr);
            finalResult = normalizeChunkResult(newChunkResults[0]);
          }
        }
      }

      // Store final result — always succeed at this point
      await supabase.from('research_insights').update({
        data: finalResult,
        status: 'completed',
        total_records_analyzed: meta.totalRecords,
      }).eq('id', insightId);

      console.log(`[Chain] ✓ Insight ${insightId} completed successfully`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Chain] Error processing chunk ${chunkIndex}:`, errorMessage);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await supabase.from('research_insights').update({
      status: 'failed', error_message: `Chunk ${chunkIndex + 1} failed: ${errorMessage}`
    }).eq('id', insightId);
  }
}

async function selfInvokeResume(supabaseUrl: string, supabaseServiceKey: string, insightId: string, chunkIndex: number, totalChunks: number, attempt = 1) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-research-insights`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resume: true, insightId, chunkIndex, totalChunks }),
    });

    if (response.ok) {
      const body = await response.text();
      console.log(`[Chain] Self-invoke success for chunk ${chunkIndex + 1}`);
    } else {
      const text = await response.text();
      console.error(`[Chain] Self-invoke failed (${response.status}): ${text}`);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
        await selfInvokeResume(supabaseUrl, supabaseServiceKey, insightId, chunkIndex, totalChunks, attempt + 1);
      }
    }
  } catch (error) {
    console.error('[Chain] Self-invoke network error:', error);
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 2000));
      await selfInvokeResume(supabaseUrl, supabaseServiceKey, insightId, chunkIndex, totalChunks, attempt + 1);
    }
  }
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();

    // ── RESUME path: self-chaining invocation ──
    if (body.resume) {
      const { insightId, chunkIndex, totalChunks } = body;
      console.log(`[Chain] Resume invocation: chunk ${chunkIndex + 1}/${totalChunks} for ${insightId}`);

      EdgeRuntime.waitUntil(
        processOneChunk(supabaseUrl, supabaseServiceKey, lovableApiKey, insightId, chunkIndex, totalChunks)
      );

      return new Response(
        JSON.stringify({ success: true, message: `Processing chunk ${chunkIndex + 1}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── INITIAL path: fetch records, create insight, start chain ──
    // Accept both camelCase and snake_case input params
    const campaignId = body.campaignId || body.campaign_id || null;
    const dateRangeStart = body.dateRangeStart || body.date_range_start || null;
    const dateRangeEnd = body.dateRangeEnd || body.date_range_end || null;
    const analysisPeriod = body.analysisPeriod || body.analysis_period || null;
    const campaignType = body.campaignType || body.campaign_type || 'move_out_survey';

    // Get user ID from JWT
    const authHeader = req.headers.get('Authorization') || '';
    let triggeredByUserId: string | null = null;
    if (authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(atob(token.split('.')[1]));
        triggeredByUserId = payload.sub || null;
      } catch { /* ignore */ }
    }

    // Fetch processed research records filtered by campaign type
    let query = supabase
      .from('bookings')
      .select(`
        id,
        booking_date,
        member_name,
        booking_transcriptions!inner (
          research_extraction,
          research_classification,
          research_processing_status,
          research_campaign_type
        )
      `)
      .eq('record_type', 'research')
      .eq('has_valid_conversation', true)
      .eq('booking_transcriptions.research_processing_status', 'completed')
      .eq('booking_transcriptions.research_campaign_type', campaignType);

    if (campaignId) query = query.eq('research_call_id', campaignId);
    if (dateRangeStart) query = query.gte('booking_date', dateRangeStart);
    if (dateRangeEnd) query = query.lte('booking_date', dateRangeEnd);

    const { data: records, error: fetchError } = await query;
    if (fetchError) throw new Error(`Failed to fetch records: ${fetchError.message}`);

    const processedRecords = (records || []).filter((r: any) => {
      const t = Array.isArray(r.booking_transcriptions) ? r.booking_transcriptions[0] : r.booking_transcriptions;
      return campaignType === 'audience_survey' ? t?.research_extraction : t?.research_classification;
    });

    if (processedRecords.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: `No processed ${campaignType} records found for the selected filters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const classifications = processedRecords.map((r: any) => {
      const t = Array.isArray(r.booking_transcriptions) ? r.booking_transcriptions[0] : r.booking_transcriptions;
      return { ...(t.research_classification || {}), _booking_id: r.id };
    });

    const extractions = processedRecords.map((r: any) => {
      const t = Array.isArray(r.booking_transcriptions) ? r.booking_transcriptions[0] : r.booking_transcriptions;
      return t.research_extraction;
    });

    // Select the right aggregation prompt based on campaign type
    const isAudienceSurvey = campaignType === 'audience_survey';

    // Fetch prompt config
    const { data: prompts } = await supabase
      .from('research_prompts')
      .select('prompt_key, prompt_text, temperature, model');

    const aggPromptKey = isAudienceSurvey ? 'aggregation_audience' : 'aggregation';
    const aggPrompt = prompts?.find((p: any) => p.prompt_key === aggPromptKey) || prompts?.find((p: any) => p.prompt_key === 'aggregation');
    const model = aggPrompt?.model || 'google/gemini-2.5-flash';
    const temperature = Number(aggPrompt?.temperature) || 0.4;
    const systemPrompt = isAudienceSurvey
      ? (aggPrompt?.prompt_text || AUDIENCE_SURVEY_AGGREGATION_PROMPT)
      : (aggPrompt?.prompt_text || DEFAULT_AGGREGATION_PROMPT);

    const dateRange = dateRangeStart && dateRangeEnd
      ? `${dateRangeStart} to ${dateRangeEnd}`
      : analysisPeriod || 'All Time';

    // Concurrent invocation guard — scope to campaign type
    const { data: existingProcessing } = await supabase
      .from('research_insights')
      .select('id, created_at')
      .eq('status', 'processing')
      .eq('campaign_type', campaignType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingProcessing) {
      const createdAt = new Date(existingProcessing.created_at).getTime();
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      if (createdAt >= thirtyMinutesAgo) {
        return new Response(
          JSON.stringify({ success: false, error: 'An analysis is already in progress. Please wait for it to complete.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      await supabase.from('research_insights')
        .update({ status: 'failed', error_message: 'Timed out during processing' })
        .eq('id', existingProcessing.id);
      console.log(`[Insights] Marked stale record ${existingProcessing.id} as failed`);
    }

    // Build record summaries for chunking — different shape per campaign type
    let recordSummaries: any[];
    if (isAudienceSurvey) {
      recordSummaries = extractions.map((ext: any, i: number) => ({
        ...ext,
        _classification: classifications[i],
        _booking_id: classifications[i]?._booking_id,
      }));
    } else {
      recordSummaries = classifications.map((c: any, i: number) => {
        const extraction = extractions[i];
        return {
          ...c,
          member_name: extraction?.member_name,
          length_of_stay: extraction?.length_of_stay,
          primary_reason_stated: extraction?.primary_reason_stated,
          issues_count: extraction?.issues_mentioned?.length || 0,
          blind_spots_count: extraction?.blind_spots?.length || 0,
          payment_was_factor: extraction?.payment_context?.payment_was_factor,
          transfer_considered: extraction?.transfer_context?.considered_transfer,
          host_mentioned: extraction?.host_context?.host_mentioned,
        };
      });
    }

    // Split into chunks
    const CHUNK_SIZE = 30;
    const chunks: any[][] = [];
    for (let i = 0; i < recordSummaries.length; i += CHUNK_SIZE) {
      chunks.push(recordSummaries.slice(i, i + CHUNK_SIZE));
    }
    const totalChunks = chunks.length;

    // Create insight record with _meta storing all chunk data
    const { data: insight, error: insertError } = await supabase
      .from('research_insights')
      .insert({
        campaign_id: campaignId || null,
        campaign_type: campaignType,
        data: {
          _meta: {
            chunks,
            dateRange,
            model,
            temperature,
            systemPrompt,
            triggeredByUserId,
            totalRecords: processedRecords.length,
            campaignType,
          },
          _chunks: [],
          _progress: { totalChunks, completedChunks: 0, totalRecords: processedRecords.length, currentPhase: 'analyzing' },
        },
        insight_type: 'aggregate',
        caller_type: null,
        status: 'processing',
        total_records_analyzed: processedRecords.length,
        analysis_period: analysisPeriod || 'custom',
        date_range_start: dateRangeStart || null,
        date_range_end: dateRangeEnd || null,
        created_by: triggeredByUserId,
      })
      .select('id')
      .single();

    if (insertError || !insight) {
      throw new Error(`Failed to create insight record: ${insertError?.message}`);
    }

    console.log(`[Insights] Created insight ${insight.id} (${campaignType}), starting self-chaining for ${processedRecords.length} records in ${totalChunks} chunks`);

    // Start processing chunk 0 in background
    EdgeRuntime.waitUntil(
      processOneChunk(supabaseUrl, supabaseServiceKey, lovableApiKey, insight.id, 0, totalChunks)
    );

    return new Response(
      JSON.stringify({
        success: true,
        insightId: insight.id,
        insight_id: insight.id,
        recordCount: processedRecords.length,
        campaignType,
        message: 'Insight generation started',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Insights] Error:`, errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
