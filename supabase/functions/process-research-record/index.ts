import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cost logging helper
async function logApiCost(supabase: any, params: {
  service_provider: string;
  service_type: string;
  edge_function: string;
  booking_id?: string;
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

// Call Lovable AI gateway
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

// Parse JSON with retry
async function parseJsonWithRetry(
  content: string,
  apiKey: string,
  model: string,
  temperature: number,
  systemPrompt: string,
  userPrompt: string
): Promise<any> {
  try {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleanContent = jsonMatch ? jsonMatch[1].trim() : content.trim();
    return JSON.parse(cleanContent);
  } catch {
    console.warn('[Parse] First attempt failed, retrying with correction prompt...');
    const retryResult = await callLovableAI(
      apiKey,
      model,
      temperature,
      systemPrompt,
      userPrompt + '\n\nYour previous response was not valid JSON. Respond ONLY with the JSON object, no preamble, no markdown backticks, no explanation before or after.'
    );
    const retryMatch = retryResult.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const retryClean = retryMatch ? retryMatch[1].trim() : retryResult.content.trim();
    return JSON.parse(retryClean);
  }
}

// ── Campaign type detection ──

// Known script IDs mapped to campaign types (mirrors src/utils/campaign-detection.ts)
const SCRIPT_ID_MAP: Record<string, string> = {
  'c701a243-1c66-425a-8f79-99a290ec5b6b': 'payment_experience',
};

interface CampaignContext {
  campaignType: string;
  scriptId: string | null;
  scriptAiPrompt: string | null;
  scriptModel: string | null;
  scriptTemperature: number | null;
  /** Provenance to stamp on booking_transcriptions.retag_source. Null = leave existing value alone. */
  retagSource: string | null;
}

async function detectCampaignContext(supabase: any, bookingId: string): Promise<CampaignContext> {
  const ctx: CampaignContext = {
    campaignType: 'move_out_survey',
    scriptId: null,
    scriptAiPrompt: null,
    scriptModel: null,
    scriptTemperature: null,
    retagSource: null,
  };

  /**
   * Precedence (highest → lowest):
   *  1. retag_source = 'script_id_route'  (deterministic linkage already established) — always trust.
   *  2. Pre-set non-default research_campaign_type — trust.
   *  3. Booking → research_call → campaign → script — deterministic, never overridden by keywords.
   *  4. Keyword fallback → stamps retag_source = 'keyword_fallback_detection'.
   *
   * retag_source vocabulary kept in sync with src/hooks/usePaymentExperienceResponses.ts -> RETAG_SOURCES.
   */
  try {
    // 0. Honor any prior provenance on the transcription row.
    const { data: preTagged } = await supabase
      .from('booking_transcriptions')
      .select('research_campaign_type, retag_source')
      .eq('booking_id', bookingId)
      .maybeSingle();

    // 0a. script_id_route is the highest-precedence stamp — never reclassify.
    if (preTagged?.retag_source === 'script_id_route' && preTagged?.research_campaign_type) {
      ctx.campaignType = preTagged.research_campaign_type;
      console.log(`[CampaignDetect] Honoring script_id_route stamp → ${ctx.campaignType} for ${bookingId}`);
      return ctx;
    }

    // 0b. Pre-set non-default campaign type (e.g. validation backfill).
    if (preTagged?.research_campaign_type &&
        preTagged.research_campaign_type !== 'move_out_survey') {
      ctx.campaignType = preTagged.research_campaign_type;
      console.log(`[CampaignDetect] Using pre-set campaign_type=${ctx.campaignType} (retag_source=${preTagged.retag_source ?? 'null'}) for ${bookingId}`);
      return ctx;
    }

    // 1. Booking → research_call → campaign → script  (DETERMINISTIC; wins over keywords).
    const { data: booking } = await supabase
      .from('bookings')
      .select('research_call_id')
      .eq('id', bookingId)
      .maybeSingle();

    let scriptId: string | null = null;

    if (booking?.research_call_id) {
      const { data: researchCall } = await supabase
        .from('research_calls')
        .select('campaign_id')
        .eq('id', booking.research_call_id)
        .maybeSingle();

      if (researchCall?.campaign_id) {
        const { data: campaign } = await supabase
          .from('research_campaigns')
          .select('script_id')
          .eq('id', researchCall.campaign_id)
          .maybeSingle();
        if (campaign?.script_id) scriptId = campaign.script_id;
      }
    }

    if (scriptId) {
      const { data: script } = await supabase
        .from('research_scripts')
        .select('id, slug, campaign_type, ai_prompt, ai_model, ai_temperature')
        .eq('id', scriptId)
        .maybeSingle();

      if (script) {
        ctx.scriptId = script.id;
        ctx.scriptAiPrompt = script.ai_prompt || null;
        ctx.scriptModel = script.ai_model || null;
        ctx.scriptTemperature = typeof script.ai_temperature === 'number' ? script.ai_temperature : null;

        // Resolution waterfall: id map → slug → campaign_type
        if (SCRIPT_ID_MAP[script.id]) {
          ctx.campaignType = SCRIPT_ID_MAP[script.id];
        } else if (script.slug && ['payment_experience', 'audience_survey'].includes(script.slug)) {
          ctx.campaignType = script.slug;
        } else if (script.campaign_type) {
          ctx.campaignType = mapCampaignType(script.campaign_type);
        }
        ctx.retagSource = 'script_id_route';
        console.log(`[CampaignDetect] Script-id route ${script.id} (slug=${script.slug}, type=${script.campaign_type}) → ${ctx.campaignType}`);
        return ctx;
      }
    }

    // 2. Fallback: transcript keywords (only when no deterministic linkage exists).
    const { data: transcription } = await supabase
      .from('booking_transcriptions')
      .select('call_transcription')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (transcription?.call_transcription) {
      const text = transcription.call_transcription.toLowerCase();
      const audienceKeywords = ['social media', 'tiktok', 'instagram', 'influencer', 'ad awareness', 'padsplit ad', 'video testimonial', 'recording a video'];
      const paymentKeywords = ['auto-pay', 'autopay', 'auto pay', 'dues date', 'payment method', 'move-in cost', 'hardship'];

      const paymentMatches = paymentKeywords.filter(kw => text.includes(kw)).length;
      if (paymentMatches >= 3) {
        ctx.campaignType = 'payment_experience';
        ctx.retagSource = 'keyword_fallback_detection';
        console.log(`[CampaignDetect] Keyword fallback (${paymentMatches} payment matches) for ${bookingId}`);
        return ctx;
      }

      const audienceMatches = audienceKeywords.filter(kw => text.includes(kw)).length;
      if (audienceMatches >= 3) {
        ctx.campaignType = 'audience_survey';
        ctx.retagSource = 'keyword_fallback_detection';
        console.log(`[CampaignDetect] Keyword fallback (${audienceMatches} audience matches) for ${bookingId}`);
        return ctx;
      }
    }

    console.log(`[CampaignDetect] Defaulting to move_out_survey for ${bookingId}`);
    return ctx;
  } catch (error) {
    console.error(`[CampaignDetect] Error for ${bookingId}:`, error);
    return ctx;
  }
}

function mapCampaignType(scriptCampaignType: string): string {
  switch (scriptCampaignType) {
    case 'audience_survey': return 'audience_survey';
    case 'payment_experience': return 'payment_experience';
    case 'satisfaction': return 'move_out_survey';
    default: return 'move_out_survey';
  }
}

// ── Payment Experience fallback prompt (used only if script has no ai_prompt) ──

const PAYMENT_EXPERIENCE_FALLBACK_PROMPT = `You are analyzing a single member call from the PadSplit Member Payment Experience Survey. The transcript is from automated speech-to-text — expect filler, crosstalk, and garbled text. Focus on substance.

Respond with ONLY a JSON object containing two top-level keys: "extraction" and "classification". No preamble, no markdown.

{
  "extraction": {
    "member_name": "string or null",
    "agent_name": "string or null",
    "phone_number": "string or null",

    "payment_literacy_score": 0-100 integer estimating how well the member understands PadSplit's payment system (dues cadence, autopay, due dates, late fees). Use null only if no payment topic discussed.,
    "payment_literacy_notes": "1-2 sentence rationale for the score",
    "payment_literacy_breakdown": {
      "pay_cadence_known": "true if member correctly stated their own pay cadence, else false. null if not discussed.",
      "dues_day_correct": "true if member correctly identified their PadSplit dues day, else false. null if not discussed.",
      "dues_amount_correct": "true if member correctly identified their weekly dues amount, else false. null if not discussed.",
      "commitment_understood": "true if member understood their PadSplit stay commitment, else false. null if not discussed.",
      "dues_day_stated": "monday|tuesday|wednesday|thursday|friday|saturday|sunday|unknown|null — the day of the week the member stated as their PadSplit payment schedule. Normalize phrases like 'every Monday', 'Mondays', 'on Monday morning' → monday (and likewise for other weekdays). If the member does not know, is unsure, or cannot identify the day → unknown. If Q2 was not addressed in the transcript → unknown. Use null only when extraction itself is impossible.",
      "dues_day_stated_raw": "raw verbatim phrase from the transcript that contained the answer, or null",
      "dues_amount_stated_usd": "number — the weekly dues amount in USD that the member states (e.g. 165). null if member did not state a numeric amount or said they were unsure.",
      "dues_amount_stated_raw": "raw verbatim phrase from the transcript containing the dues amount answer, or 'unsure' if the member said they did not know, or null if Q3 not addressed.",
      "amenities_mentioned": "array of normalized amenity tokens the member says are included in their dues. Use only these tokens: utilities, wifi, furniture, cleaning, laundry, parking, trash, water, electric, gas, none_mentioned, other. Map common phrasings: internet/Wi-Fi → wifi; power/lights → electric; bills → utilities. If the member explicitly says nothing is included or doesn't mention any amenities, return [\"none_mentioned\"]. Empty array only if Q3 was not addressed.",
      "commitment_stated": "week_to_week|month_to_month|30_days|60_days|90_days|6_months|12_months|open_ended|other_specific|unsure|unknown|null — the stated PadSplit stay commitment. Normalize: 'week to week / no commitment / as long as I want' → week_to_week; '30/60/90 days' or '3 months' → 30_days/60_days/90_days; '6 months' → 6_months; 'a year / 12 months' → 12_months; 'month to month' → month_to_month; specific dates or other concrete durations not in the list → other_specific; 'I don't know / not sure' → unsure; Q4 not present → unknown. Use null only when extraction is impossible.",
      "commitment_stated_raw": "raw verbatim phrase from the transcript that contained the commitment answer, or null"
    },

    "autopay_status": "enrolled | not_enrolled | declined | unknown",
    "autopay_blocker": "string describing what's preventing enrollment, or null",

    "move_in_cost_clarity_1to5": integer 1-5 of how clearly the member understood move-in costs at booking (5 = very clear). null if not discussed.,

    "hardship_awareness_gap": true if the member is unaware of PadSplit's hardship/extension options, false if they know about them, null if not discussed,
    "hardship_details": "string or null",

    "pay_cadence": "weekly | biweekly | semimonthly | monthly | irregular | unknown — how the member receives income",
    "pay_cycle_misalignment": true if their pay cycle doesn't align with weekly PadSplit dues, false otherwise, null if unknown,

    "friction_themes": ["short phrases describing payment-related friction the member raised"],
    "wish_capabilities": ["short phrases describing payment features the member wishes existed"],
    "key_quotes": ["1-4 direct quotes from the member about payment experience"],
    "confidence_flags": ["short notes if any field is low-confidence"],

    "raw_script_answers": {
      "<question_id>": {
        "question_id": "<id>",
        "question_text": "the script question text",
        "ai_hint": "matching ai_hint or extraction field name",
        "question_type": "multiple_choice | multiple_select | yes_no | scale | open_ended",
        "selected_option_labels": ["normalized option label(s) the member chose, e.g. 'Friday' or 'Yes'"],
        "raw_text_answer": "verbatim member phrase, or null",
        "scale_value": null,
        "supporting_quote": "short verbatim transcript excerpt (≤240 chars) supporting this answer, or null",
        "status": "answered | not_discussed | unclear",
        "confidence": "high | medium | low",
        "answered_at": null,
        "source": "ai_extraction"
      }
    }
  },
  "classification": {
    "primary_segment": "autopay_advocate | autopay_blocked | payment_struggling | payment_confused | well_informed | other",
    "human_review_recommended": true if extraction is uncertain or call surfaces a serious issue,
    "human_review_reason": "string or null"
  }
}

Rules:
- Use null (not empty strings) when a field cannot be inferred.
- Numeric scores must be integers in the stated range.
- Quotes must be verbatim from the transcript.
- "raw_script_answers" is MANDATORY and must contain ALL 17 of these question_ids — pay_cadence, dues_day_stated, dues_amount_stated_usd, amenities_mentioned, commitment_stated, reminder_system, easy_payment_benchmark, payment_channel, autopay_enrolled, autopay_barrier, move_in_cost_clarity, top_friction_theme, overdue_threshold, hardship_padsplit, hardship_host, desired_payment_methods, wish_capability. For any question the call did not cover, still emit the entry with status="not_discussed", empty selected_option_labels, raw_text_answer=null, scale_value=null, supporting_quote=null, confidence="high". Use status="unclear" when the topic is touched but the answer can't be determined. Only use status="answered" when the transcript clearly supports the answer. NEVER fabricate.
- For yes/no questions, selected_option_labels must be ["Yes"] or ["No"]. For scale questions, set scale_value (number). For open-ended, set raw_text_answer. For multi-choice/select, set selected_option_labels using normalized labels.
- Normalized label vocabularies (use EXACT strings):
  - pay_cadence: "Weekly","Bi-weekly","Semi-monthly","Monthly","Other","Unknown"
  - dues_day_stated: "Monday".."Sunday","Unknown"
  - amenities_mentioned: "Utilities","Wi-Fi","Furniture","Cleaning","Laundry","Parking","Trash","Water","Electric","Gas","None mentioned","Other"
  - commitment_stated: "Week to week","Month to month","30 days","60 days","90 days","6 months","12 months","Open ended","Other specific","Unsure"
  - payment_channel (multi-select, methods+devices): "Debit card","Credit card","Cash","Bank transfer / ACH","Money order","Other","App","Mobile browser","Desktop","Phone support"
  - autopay_barrier: "Distrust of recurring charges","Irregular income","Prefers manual control","Cash-flow constraint","No eligible payment method","Unaware auto-pay exists","Other"
  - top_friction_theme: "Auto-pay distrust","Late-fee confusion","Payment method failures","Move-in cost surprise","Pay-cycle mismatch","App / website UX","No friction reported","Other"
  - desired_payment_methods: "Cash App","Venmo","Zelle","PayPal","Apple Pay","Google Pay","Cryptocurrency","Money order","Prepaid card","None / Satisfied","Other"
  - move_in_cost_clarity: scale_value integer 1..5
  - dues_amount_stated_usd and overdue_threshold: scale_value numeric USD
- Output ONLY the JSON object — no markdown fences, no commentary.`;

// ── Payment Experience: durable per-question answer derivation ──
//
// Builds a normalized raw_script_answers map from existing extraction
// fields so the dashboard has a stable source even when the script's
// AI prompt didn't emit the new block. Question ids must match
// PE_QUESTIONS in src/utils/paymentExperienceScriptResponses.ts.

const PE_DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
  sunday: 'Sunday', unknown: 'Unknown',
};

const PE_COMMITMENT_LABELS: Record<string, string> = {
  week_to_week: 'Week-to-week', month_to_month: 'Month-to-month',
  '30_days': '30 days', '60_days': '60 days', '90_days': '90 days',
  '6_months': '6 months', '12_months': '12 months',
  open_ended: 'Open-ended', other_specific: 'Other (specific)',
  unsure: 'Unsure', unknown: 'Unknown',
};

function titleCase(s: string): string {
  return String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

function nonEmptyString(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function derivePaymentExperienceRawAnswers(ext: any): Record<string, any> {
  if (!ext || typeof ext !== 'object') return {};
  const breakdown: any = ext.payment_literacy_breakdown || {};
  const out: Record<string, any> = {};
  const now = new Date().toISOString();

  const put = (id: string, partial: any) => {
    out[id] = {
      ai_hint: id,
      answered_at: now,
      source: 'ai_extraction',
      ...partial,
    };
  };

  // Q1 pay cadence
  if (nonEmptyString(ext.pay_cadence)) {
    put('pay_cadence', {
      question_text: 'When do you typically get paid?',
      question_type: 'multiple_choice',
      selected_option_labels: [titleCase(String(ext.pay_cadence))],
      raw_text_answer: null,
    });
  }

  // Q2 dues day
  const day = nonEmptyString(breakdown.dues_day_stated);
  if (day) {
    const k = day.toLowerCase();
    put('dues_day_stated', {
      question_text: 'What is your payment schedule for your PadSplit room?',
      question_type: 'multiple_choice',
      selected_option_labels: [PE_DAY_LABELS[k] || titleCase(k)],
      raw_text_answer: nonEmptyString(breakdown.dues_day_stated_raw),
    });
  }

  // Q3a dues amount
  const duesUsd = breakdown.dues_amount_stated_usd;
  if (typeof duesUsd === 'number' && isFinite(duesUsd)) {
    put('dues_amount_stated_usd', {
      question_text: 'What is your weekly dues amount?',
      question_type: 'scale',
      scale_value: duesUsd,
      raw_text_answer: nonEmptyString(breakdown.dues_amount_stated_raw),
    });
  } else if (typeof breakdown.dues_amount_stated_raw === 'string'
    && breakdown.dues_amount_stated_raw.trim().toLowerCase() === 'unsure') {
    put('dues_amount_stated_usd', {
      question_text: 'What is your weekly dues amount?',
      question_type: 'scale',
      scale_value: null,
      selected_option_labels: ['Unsure'],
      raw_text_answer: 'unsure',
    });
  }

  // Q3b amenities
  if (Array.isArray(breakdown.amenities_mentioned) && breakdown.amenities_mentioned.length > 0) {
    const labels = breakdown.amenities_mentioned
      .map((x: any) => nonEmptyString(x))
      .filter(Boolean) as string[];
    if (labels.length > 0) {
      put('amenities_mentioned', {
        question_text: 'What amenities or services are included in your dues?',
        question_type: 'multiple_select',
        selected_option_labels: labels.map(titleCase),
        raw_text_answer: null,
      });
    }
  }

  // Q4 commitment
  const commitment = nonEmptyString(breakdown.commitment_stated);
  if (commitment) {
    const k = commitment.toLowerCase();
    put('commitment_stated', {
      question_text: 'In your own words, what is your PadSplit stay commitment — and when does it end?',
      question_type: 'multiple_choice',
      selected_option_labels: [PE_COMMITMENT_LABELS[k] || titleCase(k)],
      raw_text_answer: nonEmptyString(breakdown.commitment_stated_raw),
    });
  }

  // Q5 reminder system (open) — only if a notes verbatim exists
  const reminder = nonEmptyString(ext.payment_literacy_notes);
  if (reminder) {
    put('reminder_system', {
      question_text: 'How do you remember to pay your PadSplit dues each week?',
      question_type: 'open_ended',
      raw_text_answer: reminder,
    });
  }

  // Q6 easy payment benchmark (open)
  if (nonEmptyString(ext.easy_payment_benchmark)) {
    put('easy_payment_benchmark', {
      question_text: 'What makes a payment feel easy to you?',
      question_type: 'open_ended',
      raw_text_answer: String(ext.easy_payment_benchmark).trim(),
    });
  }

  // Q7 payment channel
  const cm = ext.channel_method;
  if (cm) {
    let method: string | null = null;
    if (typeof cm === 'string') method = nonEmptyString(cm);
    else method = nonEmptyString(cm.method);
    if (method) {
      put('payment_channel', {
        question_text: 'Where and how do you typically make your PadSplit payment?',
        question_type: 'multiple_choice',
        selected_option_labels: [titleCase(method)],
        raw_text_answer: null,
      });
    }
  }

  // Q8 autopay yes/no
  if (ext.autopay_status === 'enrolled' || ext.autopay_status === 'not_enrolled') {
    put('autopay_enrolled', {
      question_text: 'Are you enrolled in auto-pay?',
      question_type: 'yes_no',
      selected_option_labels: [ext.autopay_status === 'enrolled' ? 'Yes' : 'No'],
      raw_text_answer: null,
    });
  }

  // Q9 autopay barrier
  if (ext.autopay_status === 'not_enrolled' && nonEmptyString(ext.autopay_barrier_category)) {
    put('autopay_barrier', {
      question_text: 'What is the primary reason for not enrolling in auto-pay?',
      question_type: 'multiple_choice',
      selected_option_labels: [titleCase(String(ext.autopay_barrier_category))],
      raw_text_answer: nonEmptyString(ext.autopay_unlock_condition),
    });
  }

  // Q10 move-in cost clarity (scale 1-5)
  if (typeof ext.move_in_cost_clarity_1to5 === 'number' && isFinite(ext.move_in_cost_clarity_1to5)) {
    put('move_in_cost_clarity', {
      question_text: 'How clear was the total cost to move in? (1–5)',
      question_type: 'scale',
      scale_value: ext.move_in_cost_clarity_1to5,
      raw_text_answer: null,
    });
  }

  // Q11 top friction theme
  if (nonEmptyString(ext.top_friction_theme)) {
    put('top_friction_theme', {
      question_text: 'What part of the payment process causes the most confusion or frustration?',
      question_type: 'multiple_choice',
      selected_option_labels: [titleCase(String(ext.top_friction_theme))],
      raw_text_answer: nonEmptyString(ext.friction_verbatim),
    });
  }

  // Q12 overdue threshold (USD scale)
  const overdue = ext.overdue_threshold_belief_usd;
  if (typeof overdue === 'number' && isFinite(overdue)) {
    put('overdue_threshold', {
      question_text: "If behind on dues, what's the max overdue amount before PadSplit takes action? (USD)",
      question_type: 'scale',
      scale_value: overdue,
      raw_text_answer: null,
    });
  }

  // Q13 hardship padsplit
  const arrayToText = (v: any): string | null => {
    if (Array.isArray(v)) {
      const joined = v.map((x: any) => nonEmptyString(x)).filter(Boolean).join('; ');
      return joined || null;
    }
    return nonEmptyString(v);
  };
  const hpPadsplit = arrayToText(ext.hardship_awareness_padsplit) || nonEmptyString(ext.hardship_details);
  if (hpPadsplit) {
    put('hardship_padsplit', {
      question_text: "If you couldn't pay on time, what options do you think PadSplit offers?",
      question_type: 'open_ended',
      raw_text_answer: hpPadsplit,
    });
  }

  // Q14 hardship host
  const hpHost = arrayToText(ext.hardship_awareness_host);
  if (hpHost) {
    put('hardship_host', {
      question_text: "What options do you think your host offers if you can't pay on time?",
      question_type: 'open_ended',
      raw_text_answer: hpHost,
    });
  }

  // Q15 desired payment methods
  if (Array.isArray(ext.desired_payment_methods) && ext.desired_payment_methods.length > 0) {
    const labels = ext.desired_payment_methods
      .map((x: any) => nonEmptyString(x))
      .filter(Boolean) as string[];
    if (labels.length > 0) {
      put('desired_payment_methods', {
        question_text: 'Are there any payment methods you wish PadSplit accepted?',
        question_type: 'multiple_select',
        selected_option_labels: labels.map(titleCase),
        raw_text_answer: null,
      });
    }
  } else if (nonEmptyString(ext.desired_payment_methods)) {
    put('desired_payment_methods', {
      question_text: 'Are there any payment methods you wish PadSplit accepted?',
      question_type: 'multiple_select',
      selected_option_labels: [titleCase(String(ext.desired_payment_methods))],
      raw_text_answer: null,
    });
  }

  // Q16 wish capability (open)
  const wish = nonEmptyString(ext.wish_capability)
    || nonEmptyString(ext.wish_verbatim)
    || arrayToText(ext.wish_capabilities);
  if (wish) {
    put('wish_capability', {
      question_text: 'If you could change one thing about how PadSplit payments work, what would it be?',
      question_type: 'open_ended',
      raw_text_answer: wish,
    });
  }

  return out;
}

/**
 * Merge AI-emitted raw_script_answers (if any) with the deterministically
 * derived map. AI-provided entries win when present (they may carry richer
 * verbatim text or scale values), derived entries fill the gaps.
 */
function mergeRawScriptAnswers(
  aiProvided: any,
  derived: Record<string, any>,
): Record<string, any> {
  const merged: Record<string, any> = { ...derived };
  if (aiProvided && typeof aiProvided === 'object' && !Array.isArray(aiProvided)) {
    for (const [k, v] of Object.entries(aiProvided)) {
      if (v && typeof v === 'object') {
        merged[k] = {
          source: 'ai_extraction',
          answered_at: new Date().toISOString(),
          ...(merged[k] || {}),
          ...(v as any),
        };
      }
    }
  }
  return merged;
}

// ── Audience Survey Extraction Prompt ──

const AUDIENCE_SURVEY_PROMPT = `You are a market research analyst at PadSplit. You are processing a transcribed audience survey call between a PadSplit agent and a current or prospective member. The transcript is from automated speech-to-text — expect false starts, crosstalk, filler words, tangents, and garbled text. Focus on substance.

This is a QUANTITATIVE audience survey about social media habits, ad awareness, and content preferences. Extract structured data from the responses.

Respond with ONLY a JSON object containing two top-level keys: "extraction" and "classification". No preamble, no markdown, no explanation.

{
  "extraction": {
    "member_name": "string or null",
    "member_id": "string or null",
    "agent_name": "string or null",
    "phone_number": "string or null",
    "member_cohort": "account_created | application_started | approved_not_booked | active_member | unknown",
    "social_media_platforms": {
      "platforms_used": ["list of platforms mentioned: TikTok, Instagram, Facebook, YouTube, X/Twitter, LinkedIn, Snapchat, Facebook Groups, Other"],
      "primary_platform": "the one they use most or mentioned first",
      "uses_facebook_groups_for_housing": true
    },
    "influencer_following": {
      "follows_influencers": true,
      "influencers_mentioned": ["names if provided"]
    },
    "ad_awareness": {
      "noticed_standout_ads": true,
      "standout_ad_companies": ["company names mentioned"],
      "what_they_liked_about_ads": "description if provided",
      "has_seen_padsplit_ads": true,
      "where_seen_padsplit_ads": ["platforms/locations where they saw PadSplit ads"],
      "expected_padsplit_ad_platforms": ["where they'd expect to see PadSplit ads"]
    },
    "ad_engagement": {
      "what_makes_them_stop_scrolling": ["types of content/elements"],
      "what_makes_them_click_ad": ["motivations/elements"],
      "ad_detail_preferences": ["price | location | photos | reviews | move-in process | other"],
      "preferred_content_types": ["short_video | long_video | carousel | static_image | testimonial | other"]
    },
    "first_impressions": {
      "how_heard_about_padsplit": "source or channel",
      "first_impression": "positive | neutral | negative | mixed",
      "first_impression_details": "what they thought",
      "initial_concerns": ["list of concerns"],
      "interest_drivers": ["what made them interested"],
      "confusing_aspects": ["what was confusing about PadSplit"]
    },
    "video_testimonial": {
      "interested_in_recording": true,
      "response_details": "any additional context"
    },
    "key_quotes": ["direct quotes from the transcript"],
    "agent_observations": {
      "questions_covered_estimate": "0",
      "engagement_level": "high | medium | low",
      "notable_behavior": "any notable observations"
    },
    "confidence_flags": []
  },
  "classification": {
    "primary_segment": "social_media_heavy | ad_responsive | word_of_mouth | price_driven | research_heavy | passive_browser",
    "segment_rationale": "1-2 sentences",
    "ad_receptivity_score": 7,
    "platform_diversity_score": 5,
    "brand_awareness_level": "high | medium | low | none",
    "content_preference_profile": "video_first | image_first | text_first | mixed",
    "acquisition_channel_strength": "strong | moderate | weak",
    "referral_potential": "high | medium | low",
    "key_marketing_insight": "1-2 sentences about what this response tells us about our marketing",
    "human_review_recommended": false,
    "human_review_reason": null
  }
}

EXTRACTION RULES:
- If information is not in the transcript, use null or empty arrays. NEVER fabricate.
- For multiple-choice questions, extract ALL options the member selected.
- For quotes, use EXACT words from the transcript.
- Focus on capturing quantitative selections (which platforms, which content types) over narrative.
- When the member gives vague answers, use confidence_flags to note uncertainty.
- The member_cohort should be inferred from context if the agent mentions it.`;

// ── Default merged prompt (Move-Out Survey - combines extraction + classification in one call) ──

const DEFAULT_MERGED_PROMPT = `You are a qualitative research analyst and housing operations classifier at PadSplit. You are processing a transcribed move-out interview between a PadSplit agent and a former member. The transcript is from automated speech-to-text — expect false starts, crosstalk, filler words, tangents, and garbled text. Focus on substance.

You will perform TWO tasks in a single pass:
1. **Extract** structured data from the transcript (issues, context, quotes, agent observations).
2. **Classify** the case using PadSplit's internal framework (reason codes, preventability, addressability).

Respond with ONLY a JSON object containing two top-level keys: "extraction" and "classification". No preamble, no markdown, no explanation.

{
  "extraction": {
    "member_name": "string or null",
    "member_id": "string or null",
    "agent_name": "string or null",
    "length_of_stay": "string or null",
    "phone_number": "string or null",
    "primary_reason_stated": "The member's own explanation of why they left, condensed to 1-3 sentences using their framing and language.",
    "primary_reason_interpreted": "Your analytical interpretation of the TRUE root cause. Apply the Stressor → Failure Point → Breaking Point framework.",
    "trigger_type": "gradual | single_event | external_life_change | compound",
    "trigger_description": "What specifically happened or changed",
    "issues_mentioned": [
      {
        "issue": "Short clear description",
        "category": "maintenance | host_behavior | roommate_conflict | payment_difficulty | employment | safety | cleanliness | communication | policy_confusion | transfer_friction | life_change | other",
        "severity_expressed": "low | medium | high | critical",
        "was_reported_to_padsplit": true,
        "padsplit_response_if_reported": "What happened when they reported it, or null",
        "escalated_over_time": false,
        "quotes": ["direct quotes"]
      }
    ],
    "payment_context": {
      "payment_was_factor": false,
      "employment_related": false,
      "extension_requested": false,
      "extension_experience": null,
      "miscommunication_present": false,
      "miscommunication_details": null,
      "outstanding_balance": null,
      "balance_blocking_return": false,
      "pattern_of_nonpayment": false,
      "third_party_payments": false
    },
    "transfer_context": {
      "considered_transfer": false,
      "aware_of_option": false,
      "barrier_to_transfer": null,
      "transfer_would_have_retained": null
    },
    "host_context": {
      "host_mentioned": false,
      "host_sentiment": "not_mentioned",
      "host_issues": [],
      "host_responsiveness": "not_discussed",
      "host_legal_concerns": null
    },
    "roommate_context": {
      "roommate_issues": false,
      "nature_of_conflict": null,
      "was_reported": false,
      "why_not_reported": null
    },
    "blind_spots": [],
    "improvement_suggestions": [],
    "would_return_to_padsplit": "unclear",
    "return_conditions": null,
    "emotional_tone": "neutral",
    "agent_observations": {
      "questions_covered_estimate": "0",
      "sections_skipped": [],
      "agent_stayed_on_script": false,
      "agent_offered_solutions": false,
      "agent_made_promises": false,
      "agent_probed_deeper": false,
      "notable_agent_behavior": null
    },
    "key_quotes": [],
    "confidence_flags": []
  },
  "classification": {
    "primary_reason_code": "EXACTLY one of the 7 codes below — 'Other' is NOT valid: Host Negligence / Property Condition | Payment Friction / Financial Hardship | Roommate Conflict / Safety Concern | Communication Breakdown / Support Dissatisfaction | Policy Confusion / Lack of Flexibility | External Life Event / Positive Move-On | Data Error / Invalid Record",
    "primary_reason_detail": "1-2 sentences on why this code was chosen",
    "secondary_reason_codes": [],
    "addressability": "Addressable | Non-addressable | Partially addressable",
    "addressability_rationale": "2-3 sentences",
    "regrettability": "High | Medium | Low",
    "regrettability_rationale": "2-3 sentences",
    "preventability_score": 5,
    "preventability_rationale": "2-3 sentences",
    "experience_deterioration": "gradual | trigger_event | compound",
    "categorization_framework": "Addressable | Non-addressable | Non-regrettable but addressable | Regrettable (non-fraud) | Regrettable fraud | Non-regrettable (policy/collections)",
    "early_warning_signals": [
      {
        "signal": "The detectable signal",
        "when_it_appeared": "When in the member journey",
        "was_it_caught": "Yes | Partially | No",
        "what_should_have_happened": "The ideal system response"
      }
    ],
    "intervention_opportunities": [
      {
        "moment": "The specific window",
        "action": "Concrete implementable action",
        "likelihood_of_retention": "high | medium | low",
        "department_responsible": "support | host_ops | product | payments | trust_safety | retention"
      }
    ],
    "blind_spots": [],
    "key_quotes": [],
    "root_cause_summary": "2-3 sentences a VP could read in 10 seconds.",
    "what_we_could_have_done": "2-3 sentences.",
    "agent_performance_notes": "Coverage and quality notes.",
    "case_brief": "150-200 word narrative summary using Stressor → Failure Point → Breaking Point framework.",
    "human_review_recommended": false,
    "human_review_reason": null
  }
}

EXTRACTION RULES:
- If information is not in the transcript, use null. NEVER fabricate.
- Extract ALL issues mentioned, even tangential ones.
- For blind_spots, be thorough — look for silent suffering, assumptions about PadSplit's limitations, information gaps.
- For quotes, use EXACT words from the transcript.
- When ambiguous, use confidence_flags rather than presenting interpretation as fact.
- Record the member's stated reason exactly as they expressed it in "primary_reason_stated".
- In "primary_reason_interpreted", note ONLY if other evidence in the transcript contradicts or complicates the stated reason. Cite the specific evidence.
- If no contradicting evidence exists, "primary_reason_interpreted" should match the stated reason.
- Do NOT assume hidden motivations. Flag discrepancies only when the transcript itself provides conflicting signals.
- Use "confidence_flags" to note any ambiguity rather than choosing an interpretation.

CLASSIFICATION RULES:
1. PRIMARY CODE = the issue which, if resolved, would MOST LIKELY have retained the member.
2. PREVENTABILITY SCORING: 9-10: Clear signals, tools to intervene, failed to act. 7-8: Possible with proactive changes. 5-6: Partially preventable. 3-4: Mostly external. 1-2: Fully external.
3. REGRETTABILITY: High = engaged member we should have kept. Low = departure was inevitable or acceptable.
4. FLAG FOR HUMAN REVIEW when: transcript is ambiguous, contradictory, involves legal issues, or uncertain between primary codes.
5. Base your classification on what the member ACTUALLY said in the transcript. If the extraction shows weak or ambiguous evidence for the primary reason, reduce the preventability score accordingly.

CLASSIFICATION RULES — MANDATORY:
Classify this record into EXACTLY ONE of these 7 codes. "Other" is NOT a valid option. Every record MUST be assigned to one of these:

1. "Host Negligence / Property Condition" — property issues, maintenance, mold, pests, dirty, uninhabitable, host unresponsive, misrepresentation, renovation issues, overcrowding due to host
2. "Payment Friction / Financial Hardship" — can't afford, rent increase, rent too high, payment schedules, late fees, collections, billing disputes, pricing concerns, saving money
3. "Roommate Conflict / Safety Concern" — roommate issues, noise, cleanliness from roommates, harassment, drugs, theft, safety fears, assault, hostile environment from other members
4. "Communication Breakdown / Support Dissatisfaction" — PadSplit support unresponsive, conflicting info, feeling unheard, process failures, app issues, platform problems
5. "Policy Confusion / Lack of Flexibility" — transfer rules, guest policies, house rules, expectations vs reality, shared bathroom/kitchen objection, didn't realize it was shared living
6. "External Life Event / Positive Move-On" — buying home, job relocation, family, graduation, personal reasons, temporary housing, moving out of town, needed own space, incarceration, health issues, military, got arrested, relationship change, found other housing, wanted independence, vague "personal reasons", "just because" with no PadSplit complaint
7. "Data Error / Invalid Record" — member never moved in, wrong person contacted, identity theft, duplicate record, member denies move-out, call too short for classification. Always set human_review_recommended = true.

EDGE CASE RULES:
- Vague reasons ("personal", "just because", "needed a change") with NO specific PadSplit complaint = External Life Event
- "Needed my own space" / "wanted independence" = External Life Event
- "Rent too high" / "can't afford" / "price increase" = Payment Friction
- "Didn't like sharing bathroom/kitchen" = Policy Confusion
- "Got arrested" / "going through something" = External Life Event
- If member gives vague reason but transcript reveals a real issue later, classify based on the ACTUAL issue
- If multiple issues, pick the one discussed most or that upset the member most
- If transcript is unintelligible or under 30 words = Data Error
- NEVER output "Other", "Unspecified", "Unknown", or "General"
- When in doubt between two specific categories, pick the one with more evidence. NEVER default to "Other".`;

// Legacy default prompts (kept for fallback if separate extraction/classification prompts exist in DB)
const DEFAULT_EXTRACTION_PROMPT = `You are a qualitative research analyst processing a transcribed move-out interview between a PadSplit agent and a former member. The transcript is from automated speech-to-text — expect false starts, crosstalk, filler words, tangents, and garbled text. Focus on substance.

Respond with ONLY the JSON object below. No preamble, no markdown, no explanation.

{
  "member_name": "string or null",
  "member_id": "string or null",
  "agent_name": "string or null",
  "length_of_stay": "string or null",
  "phone_number": "string or null",
  "primary_reason_stated": "The member's own explanation of why they left, condensed to 1-3 sentences using their framing and language.",
  "primary_reason_interpreted": "Your analytical interpretation of the TRUE root cause. Apply the Stressor → Failure Point → Breaking Point framework.",
  "trigger_type": "gradual | single_event | external_life_change | compound",
  "trigger_description": "What specifically happened or changed",
  "issues_mentioned": [
    {
      "issue": "Short clear description",
      "category": "maintenance | host_behavior | roommate_conflict | payment_difficulty | employment | safety | cleanliness | communication | policy_confusion | transfer_friction | life_change | other",
      "severity_expressed": "low | medium | high | critical",
      "was_reported_to_padsplit": true,
      "padsplit_response_if_reported": "What happened when they reported it, or null",
      "escalated_over_time": false,
      "quotes": ["direct quotes"]
    }
  ],
  "payment_context": {
    "payment_was_factor": false,
    "employment_related": false,
    "extension_requested": false,
    "extension_experience": null,
    "miscommunication_present": false,
    "miscommunication_details": null,
    "outstanding_balance": null,
    "balance_blocking_return": false,
    "pattern_of_nonpayment": false,
    "third_party_payments": false
  },
  "transfer_context": {
    "considered_transfer": false,
    "aware_of_option": false,
    "barrier_to_transfer": null,
    "transfer_would_have_retained": null
  },
  "host_context": {
    "host_mentioned": false,
    "host_sentiment": "not_mentioned",
    "host_issues": [],
    "host_responsiveness": "not_discussed",
    "host_legal_concerns": null
  },
  "roommate_context": {
    "roommate_issues": false,
    "nature_of_conflict": null,
    "was_reported": false,
    "why_not_reported": null
  },
  "blind_spots": [],
  "improvement_suggestions": [],
  "would_return_to_padsplit": "unclear",
  "return_conditions": null,
  "emotional_tone": "neutral",
  "agent_observations": {
    "questions_covered_estimate": "0",
    "sections_skipped": [],
    "agent_stayed_on_script": false,
    "agent_offered_solutions": false,
    "agent_made_promises": false,
    "agent_probed_deeper": false,
    "notable_agent_behavior": null
  },
  "key_quotes": [],
  "confidence_flags": []
}

RULES:
- If information is not in the transcript, use null. NEVER fabricate.
- Extract ALL issues mentioned, even tangential ones.
- For blind_spots, be thorough — look for silent suffering, assumptions about PadSplit's limitations, information gaps.
- For quotes, use EXACT words from the transcript.
- When ambiguous, use confidence_flags rather than presenting interpretation as fact.

DISCREPANCY FLAGGING:
- Record the member's stated reason exactly as they expressed it in "primary_reason_stated".
- In "primary_reason_interpreted", note ONLY if other evidence in the transcript contradicts or complicates the stated reason. Cite the specific evidence.
- If no contradicting evidence exists, "primary_reason_interpreted" should match the stated reason.
- Do NOT assume hidden motivations. Flag discrepancies only when the transcript itself provides conflicting signals.
- Use "confidence_flags" to note any ambiguity rather than choosing an interpretation.`;

const DEFAULT_CLASSIFICATION_PROMPT = `You are a housing operations analyst at PadSplit. You are receiving structured extraction data from a member move-out interview. Classify this case using PadSplit's internal framework.

Input: the JSON extraction from the previous processing step.

Respond with ONLY the JSON object below. No preamble, no markdown, no explanation.

{
  "primary_reason_code": "EXACTLY one of: Transfer Denied / Couldn't Transfer | Maintenance Delays | Roommate Conflict | Safety Concern | Noise or Cleanliness Issues | Communication Breakdown / Support Dissatisfaction | Policy Confusion / Lack of Flexibility | Payment Extension Not Offered | Collections – No Flexibility | Pattern of Non-Payment | Job Relocation | Moving in with Family | Buying a Home | Health Issues | Immigration Changes | Marriage | Military Relocation | Fraud / Misrepresentation | Host Negligence / Property Condition | Other",
  "primary_reason_detail": "1-2 sentences on why this code was chosen",
  "secondary_reason_codes": [],
  "addressability": "Addressable | Non-addressable | Partially addressable",
  "addressability_rationale": "2-3 sentences",
  "regrettability": "High | Medium | Low",
  "regrettability_rationale": "2-3 sentences",
  "preventability_score": 5,
  "preventability_rationale": "2-3 sentences",
  "experience_deterioration": "gradual | trigger_event | compound",
  "categorization_framework": "Addressable | Non-addressable | Non-regrettable but addressable | Regrettable (non-fraud) | Regrettable fraud | Non-regrettable (policy/collections)",
  "early_warning_signals": [
    {
      "signal": "The detectable signal",
      "when_it_appeared": "When in the member journey",
      "was_it_caught": "Yes | Partially | No",
      "what_should_have_happened": "The ideal system response"
    }
  ],
  "intervention_opportunities": [
    {
      "moment": "The specific window",
      "action": "Concrete implementable action",
      "likelihood_of_retention": "high | medium | low",
      "department_responsible": "support | host_ops | product | payments | trust_safety | retention"
    }
  ],
  "blind_spots": [],
  "key_quotes": [],
  "root_cause_summary": "2-3 sentences a VP could read in 10 seconds.",
  "what_we_could_have_done": "2-3 sentences.",
  "agent_performance_notes": "Coverage and quality notes.",
  "case_brief": "150-200 word narrative summary using Stressor → Failure Point → Breaking Point framework.",
  "human_review_recommended": false,
  "human_review_reason": null
}

CLASSIFICATION RULES:
1. PRIMARY CODE = the issue which, if resolved, would MOST LIKELY have retained the member.
2. PREVENTABILITY SCORING: 9-10: Clear signals, tools to intervene, failed to act. 7-8: Possible with proactive changes. 5-6: Partially preventable. 3-4: Mostly external. 1-2: Fully external.
3. REGRETTABILITY: High = engaged member we should have kept. Low = departure was inevitable or acceptable.
4. FLAG FOR HUMAN REVIEW when: transcript is ambiguous, contradictory, involves legal issues, or uncertain between primary codes.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { bookingId } = await req.json();
    if (!bookingId) throw new Error('Missing bookingId');

    console.log(`[Research] Processing record for booking ${bookingId}`);

    // Check if booking has a valid conversation
    const { data: booking } = await supabase
      .from('bookings')
      .select('has_valid_conversation')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking?.has_valid_conversation) {
      console.log(`[Research] Skipping ${bookingId} — not a valid conversation (voicemail/brief attempt)`);
      return new Response(
        JSON.stringify({ success: false, reason: 'Not a valid conversation', bookingId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch transcript
    const { data: transcription, error: fetchError } = await supabase
      .from('booking_transcriptions')
      .select('id, call_transcription, research_processing_status, updated_at')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (fetchError || !transcription) {
      throw new Error(`No transcription found for booking ${bookingId}`);
    }

    if (!transcription.call_transcription) {
      throw new Error(`Empty transcript for booking ${bookingId}`);
    }

    // Allow re-processing if stuck in 'processing' for >15 minutes (stale)
    if (transcription.research_processing_status === 'processing') {
      const updatedAt = new Date(transcription.updated_at || 0);
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (updatedAt > fifteenMinutesAgo) {
        return new Response(
          JSON.stringify({ success: false, reason: 'Already processing' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`[Research] Record ${bookingId} stuck in processing since ${updatedAt.toISOString()}, resetting and retrying`);
    }

    // ── Detect campaign type ──
    const ctx = await detectCampaignContext(supabase, bookingId);
    const campaignType = ctx.campaignType;
    console.log(`[Research] Campaign type for ${bookingId}: ${campaignType}`);

    // Mark as processing
    await supabase
      .from('booking_transcriptions')
      .update({ research_processing_status: 'processing' })
      .eq('booking_id', bookingId);

    let extraction: any;
    let classification: any;

    if (campaignType === 'payment_experience') {
      // ── PAYMENT EXPERIENCE MODE ──
      const systemPrompt = ctx.scriptAiPrompt || PAYMENT_EXPERIENCE_FALLBACK_PROMPT;
      const model = ctx.scriptModel || 'google/gemini-2.5-flash';
      const temperature = ctx.scriptTemperature ?? 0.2;

      console.log(`[Research] Running PAYMENT EXPERIENCE prompt (${model}${ctx.scriptAiPrompt ? ', script' : ', fallback'}) for ${bookingId}`);
      const result = await callLovableAI(
        lovableApiKey,
        model,
        temperature,
        systemPrompt,
        `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
      );

      const parsed = await parseJsonWithRetry(
        result.content,
        lovableApiKey,
        model,
        temperature,
        systemPrompt,
        `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
      );

      // Script's prompt may return a flat object or { extraction, classification }
      extraction = parsed.extraction || parsed;
      classification = parsed.classification || { human_review_recommended: false };

      // Durable per-question answer persistence. If the AI prompt did not
      // emit raw_script_answers (e.g. older script-stored prompt), derive a
      // normalized version from the existing extraction fields so the
      // dashboard always has a single preferred source going forward.
      try {
        extraction.raw_script_answers = mergeRawScriptAnswers(
          extraction.raw_script_answers,
          derivePaymentExperienceRawAnswers(extraction)
        );
      } catch (e) {
        console.warn(`[Research] raw_script_answers derivation failed for ${bookingId}:`, e);
      }

      console.log(`[Research] Payment Experience complete. Literacy: ${extraction?.payment_literacy_score}, Autopay: ${extraction?.autopay_status}, raw_answers: ${Object.keys(extraction.raw_script_answers || {}).length}`);

      await logApiCost(supabase, {
        service_provider: 'lovable_ai',
        service_type: 'research_payment_experience',
        edge_function: 'process-research-record',
        booking_id: bookingId,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        metadata: { model, prompt: 'payment_experience', campaign_type: campaignType, script_id: ctx.scriptId },
        is_internal: false,
      });

    } else if (campaignType === 'audience_survey') {
      // ── AUDIENCE SURVEY MODE ──

      // Check for custom audience survey prompt in research_prompts table
      const { data: audiencePrompts } = await supabase
        .from('research_prompts')
        .select('prompt_key, prompt_text, temperature, model')
        .eq('campaign_type', 'audience_survey');

      const customAudiencePrompt = audiencePrompts?.find((p: any) => p.prompt_key === 'merged' || p.prompt_key === 'audience_survey');
      const systemPrompt = customAudiencePrompt?.prompt_text || AUDIENCE_SURVEY_PROMPT;
      const model = customAudiencePrompt?.model || 'google/gemini-2.5-flash';
      const temperature = Number(customAudiencePrompt?.temperature) || 0.2;

      console.log(`[Research] Running AUDIENCE SURVEY prompt (${model}${customAudiencePrompt ? ', custom' : ', default'}) for ${bookingId}`);
      const result = await callLovableAI(
        lovableApiKey,
        model,
        temperature,
        systemPrompt,
        `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
      );

      const parsed = await parseJsonWithRetry(
        result.content,
        lovableApiKey,
        model,
        temperature,
        systemPrompt,
        `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
      );

      extraction = parsed.extraction || parsed;
      classification = parsed.classification || { human_review_recommended: false };

      console.log(`[Research] Audience survey complete. Segment: ${classification.primary_segment}, Platforms: ${extraction.social_media_platforms?.platforms_used?.length || 0}`);

      await logApiCost(supabase, {
        service_provider: 'lovable_ai',
        service_type: 'research_audience_survey',
        edge_function: 'process-research-record',
        booking_id: bookingId,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        metadata: { model, prompt: customAudiencePrompt ? 'custom_audience' : 'audience_survey', campaign_type: campaignType },
        is_internal: false,
      });

    } else {
      // ── MOVE-OUT SURVEY MODE (existing logic) ──

      // Fetch custom prompts from research_prompts table, filtered by campaign_type
      const { data: prompts } = await supabase
        .from('research_prompts')
        .select('prompt_key, prompt_text, temperature, model')
        .or('campaign_type.eq.move_out_survey,campaign_type.is.null');

      const mergedPromptRow = prompts?.find((p: any) => p.prompt_key === 'merged');
      const extractionPromptRow = prompts?.find((p: any) => p.prompt_key === 'extraction');
      const classificationPromptRow = prompts?.find((p: any) => p.prompt_key === 'classification');

      // Decide processing mode: merged (new) or legacy two-step
      const useMerged = !!mergedPromptRow || (!extractionPromptRow && !classificationPromptRow);

      if (useMerged) {
        // ── MERGED SINGLE-CALL MODE ──
        const systemPrompt = mergedPromptRow?.prompt_text || DEFAULT_MERGED_PROMPT;
        const model = mergedPromptRow?.model || 'google/gemini-2.5-flash';
        const temperature = Number(mergedPromptRow?.temperature) || 0.2;

        console.log(`[Research] Running MERGED prompt (${model}) for ${bookingId}`);
        const result = await callLovableAI(
          lovableApiKey,
          model,
          temperature,
          systemPrompt,
          `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
        );

        const parsed = await parseJsonWithRetry(
          result.content,
          lovableApiKey,
          model,
          temperature,
          systemPrompt,
          `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
        );

        extraction = parsed.extraction || parsed;
        classification = parsed.classification;

        if (!classification) {
          console.warn(`[Research] Merged output missing 'classification' key for ${bookingId}, marking for human review`);
          classification = { human_review_recommended: true, human_review_reason: 'Merged prompt did not return classification' };
        }

        console.log(`[Research] Merged prompt complete. Primary code: ${classification.primary_reason_code}, Issues: ${extraction.issues_mentioned?.length || 0}`);

        await logApiCost(supabase, {
          service_provider: 'lovable_ai',
          service_type: 'research_merged',
          edge_function: 'process-research-record',
          booking_id: bookingId,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          metadata: { model, prompt: 'merged', campaign_type: campaignType },
          is_internal: false,
        });

      } else {
        // ── LEGACY TWO-STEP MODE ──
        const extractionSystemPrompt = extractionPromptRow?.prompt_text || DEFAULT_EXTRACTION_PROMPT;
        const extractionModel = extractionPromptRow?.model || 'google/gemini-2.5-flash';
        const extractionTemp = Number(extractionPromptRow?.temperature) || 0.2;

        const classificationSystemPrompt = classificationPromptRow?.prompt_text || DEFAULT_CLASSIFICATION_PROMPT;
        const classificationModel = classificationPromptRow?.model || 'google/gemini-2.5-pro';
        const classificationTemp = Number(classificationPromptRow?.temperature) || 0.2;

        console.log(`[Research] Running Prompt A (extraction, legacy) for ${bookingId}`);
        const extractionResult = await callLovableAI(
          lovableApiKey, extractionModel, extractionTemp, extractionSystemPrompt,
          `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
        );

        extraction = await parseJsonWithRetry(
          extractionResult.content, lovableApiKey, extractionModel, extractionTemp,
          extractionSystemPrompt, `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
        );

        await logApiCost(supabase, {
          service_provider: 'lovable_ai', service_type: 'research_extraction',
          edge_function: 'process-research-record', booking_id: bookingId,
          input_tokens: extractionResult.inputTokens, output_tokens: extractionResult.outputTokens,
          metadata: { model: extractionModel, prompt: 'A', campaign_type: campaignType }, is_internal: false,
        });

        console.log(`[Research] Running Prompt B (classification, legacy) for ${bookingId}`);
        const classificationResult = await callLovableAI(
          lovableApiKey, classificationModel, classificationTemp, classificationSystemPrompt,
          `Here is the structured extraction to classify:\n\n${JSON.stringify(extraction, null, 2)}`
        );

        classification = await parseJsonWithRetry(
          classificationResult.content, lovableApiKey, classificationModel, classificationTemp,
          classificationSystemPrompt, `Here is the structured extraction to classify:\n\n${JSON.stringify(extraction, null, 2)}`
        );

        await logApiCost(supabase, {
          service_provider: 'lovable_ai', service_type: 'research_classification',
          edge_function: 'process-research-record', booking_id: bookingId,
          input_tokens: classificationResult.inputTokens, output_tokens: classificationResult.outputTokens,
          metadata: { model: classificationModel, prompt: 'B', campaign_type: campaignType }, is_internal: false,
        });
      }
    }

    // Store results with campaign type
    const updatePayload: Record<string, unknown> = {
      research_extraction: extraction,
      research_classification: classification,
      research_processed_at: new Date().toISOString(),
      research_processing_status: 'completed',
      research_human_review: classification.human_review_recommended === true,
      research_campaign_type: campaignType,
    };
    // Stamp provenance only when this run produced one (script-id route or keyword fallback).
    // Never downgrade an existing 'script_id_route' stamp.
    if (ctx.retagSource) {
      updatePayload.retag_source = ctx.retagSource;
    }
    const { error: updateError } = await supabase
      .from('booking_transcriptions')
      .update(updatePayload)
      .eq('booking_id', bookingId);

    if (updateError) {
      throw new Error(`Failed to store results: ${updateError.message}`);
    }

    console.log(`[Research] Successfully processed booking ${bookingId} (${campaignType}). Human review: ${classification.human_review_recommended}`);

    return new Response(
      JSON.stringify({
        success: true,
        bookingId,
        campaignType,
        primaryReasonCode: classification.primary_reason_code,
        primarySegment: classification.primary_segment,
        preventabilityScore: classification.preventability_score,
        humanReviewRecommended: classification.human_review_recommended,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Research] Error:`, errorMessage);

    // Try to update status to failed
    try {
      const { bookingId } = await req.clone().json();
      if (bookingId) {
        await supabase
          .from('booking_transcriptions')
          .update({ research_processing_status: 'failed' })
          .eq('booking_id', bookingId);
      }
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
