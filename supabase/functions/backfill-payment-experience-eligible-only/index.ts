// supabase/functions/backfill-payment-experience-eligible-only/index.ts
// Targeted, chunked, self-retriggering backfill that reconstructs the
// canonical raw_script_answers map ONLY for Payment Experience calls
// the dashboard considers eligible. Mirrors evaluateEligibility in
// src/hooks/usePaymentExperienceResponses.ts:
//   - bookings.has_valid_conversation IS NULL or TRUE
//   - bookings.call_duration_seconds IS NULL, 0, or >= 120
//   - research_extraction has >= 3 of 5 required fields
//
// Merge-safe: never overwrites agent_runtime or well-formed ai_extraction.
// May overwrite broad-backfill (ai_backfill_v1) entries and prior
// eligible-only entries with status not_discussed / unclear when the
// new pass finds a transcript-supported answer.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

const CHUNK_SIZE = 25;
const PACE_MS = 10_000;
const MODEL = 'google/gemini-2.5-flash';
const SERVICE_TYPE = 'research_payment_experience_backfill_eligible_only';
const EDGE_FUNCTION = 'backfill-payment-experience-eligible-only';
const ELIGIBLE_VERSION = 1;
const ELIGIBLE_SOURCE = 'ai_backfill_eligible_v1';

// gemini-2.5-flash pricing (USD per 1M tokens)
const PRICE_IN_PER_M = 0.30;
const PRICE_OUT_PER_M = 2.50;

const EXPECTED_IDS = [
  'pay_cadence',
  'dues_day_stated',
  'dues_amount_stated_usd',
  'amenities_mentioned',
  'commitment_stated',
  'reminder_system',
  'easy_payment_benchmark',
  'payment_channel',
  'autopay_enrolled',
  'autopay_barrier',
  'move_in_cost_clarity',
  'top_friction_theme',
  'overdue_threshold',
  'hardship_padsplit',
  'hardship_host',
  'desired_payment_methods',
  'wish_capability',
] as const;

const REQUIRED_EXTRACTION_FIELDS = [
  'payment_literacy_score',
  'autopay_status',
  'move_in_cost_clarity_1to5',
  'pay_cadence',
  'top_friction_theme',
] as const;
const MIN_EXTRACTION_FIELDS = 3;
const MIN_CALL_SECONDS = 120;

const PROTECTED_SOURCES = new Set(['agent_runtime', 'ai_extraction']);

const PROMPT = `You are reconstructing structured survey answers from a transcribed PadSplit Member Payment Experience Survey call. The transcript comes from automated speech-to-text — expect filler, crosstalk, and noise. Be conservative: do NOT fabricate answers.

Return ONLY a JSON object (no markdown) with a single top-level key "raw_script_answers" whose value is an object keyed by these 17 question_ids:

pay_cadence, dues_day_stated, dues_amount_stated_usd, amenities_mentioned, commitment_stated, reminder_system, easy_payment_benchmark, payment_channel, autopay_enrolled, autopay_barrier, move_in_cost_clarity, top_friction_theme, overdue_threshold, hardship_padsplit, hardship_host, desired_payment_methods, wish_capability.

Every one of the 17 keys MUST be present. Each value is an object with this exact shape:
{
  "question_id": "<id>",
  "question_text": "<the survey question text>",
  "question_type": "multiple_choice | multiple_select | yes_no | scale | open_ended",
  "selected_option_labels": [<strings, normalized — empty array if none>],
  "raw_text_answer": "<verbatim member phrase or null>",
  "scale_value": <number or null>,
  "supporting_quote": "<short verbatim transcript excerpt (≤240 chars) or null>",
  "status": "answered | not_discussed | unclear",
  "confidence": "high | medium | low",
  "source": "ai_backfill_eligible_v1"
}

Rules:
- If the question was NOT discussed: status="not_discussed", selected_option_labels=[], raw_text_answer=null, scale_value=null, supporting_quote=null, confidence="high".
- If discussed but ambiguous: status="unclear" with whatever partial evidence you have. confidence="low".
- Only status="answered" when the transcript clearly supports the answer.
- NEVER invent facts. When in doubt, prefer "not_discussed" or "unclear".

Question texts and normalization vocabularies (use these EXACT label strings in selected_option_labels):

Q1 pay_cadence — "When do you typically get paid?" (multiple_choice)
  Allowed labels: "Weekly", "Bi-weekly", "Semi-monthly", "Monthly", "Other", "Unknown".

Q2 dues_day_stated — "What is your payment schedule for your PadSplit room?" (multiple_choice)
  Allowed labels: "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","Unknown".

Q3a dues_amount_stated_usd — "What is your weekly dues amount?" (scale, USD)
  Set scale_value to the numeric USD amount the member states (e.g. 165). If the member explicitly says they are unsure, set selected_option_labels=["Unsure"], scale_value=null, status="answered".

Q3b amenities_mentioned — "What amenities or services are included in your dues?" (multiple_select)
  Allowed labels: "Utilities","Wi-Fi","Furniture","Cleaning","Laundry","Parking","Trash","Water","Electric","Gas","None mentioned","Other".
  Map: internet/Wi-Fi → "Wi-Fi"; power/lights → "Electric"; bills → "Utilities".

Q4 commitment_stated — "In your own words, what is your PadSplit stay commitment — and when does it end?" (multiple_choice)
  Allowed labels: "Week to week","Month to month","30 days","60 days","90 days","6 months","12 months","Open ended","Other specific","Unsure".

Q5 reminder_system — "How do you remember to pay your PadSplit dues each week?" (open_ended) — verbatim answer in raw_text_answer.

Q6 easy_payment_benchmark — "What makes a payment feel easy to you?" (open_ended) — verbatim in raw_text_answer.

Q7 payment_channel — "Where and how do you typically make your PadSplit payment?" (multiple_select)
  Method labels: "Debit card","Credit card","Cash","Bank transfer / ACH","Money order","Other".
  Device labels: "App","Mobile browser","Desktop","Phone support","Other".
  Include any of method + device labels the member mentions.

Q8 autopay_enrolled — "Are you enrolled in auto-pay?" (yes_no)
  selected_option_labels = ["Yes"] or ["No"].

Q9 autopay_barrier — "What is the primary reason for not enrolling in auto-pay?" (multiple_choice)
  Allowed labels: "Distrust of recurring charges","Irregular income","Prefers manual control","Cash-flow constraint","No eligible payment method","Unaware auto-pay exists","Other".

Q10 move_in_cost_clarity — "How clear was the total cost to move in? (1–5)" (scale, 1..5)
  Set scale_value to an integer 1..5.

Q11 top_friction_theme — "What part of the payment process causes the most confusion or frustration?" (multiple_choice — pick ONE primary)
  Allowed labels: "Auto-pay distrust","Late-fee confusion","Payment method failures","Move-in cost surprise","Pay-cycle mismatch","App / website UX","No friction reported","Other".

Q12 overdue_threshold — "If behind on dues, what's the max overdue amount before PadSplit takes action? (USD)" (scale, USD)
  Set scale_value to the numeric USD amount the member states.

Q13 hardship_padsplit — "If you couldn't pay on time, what options do you think PadSplit offers?" (open_ended)

Q14 hardship_host — "What options do you think your host offers if you can't pay on time?" (open_ended)

Q15 desired_payment_methods — "Are there any payment methods you wish PadSplit accepted?" (multiple_select)
  Allowed labels: "Cash App","Venmo","Zelle","PayPal","Apple Pay","Google Pay","Cryptocurrency","Money order","Prepaid card","None / Satisfied","Other".

Q16 wish_capability — "If you could change one thing about how PadSplit payments work, what would it be?" (open_ended)

Output ONLY the JSON object.`;

interface Row {
  id: string;
  booking_id: string;
  call_transcription: string;
  research_extraction: any;
  bookings: {
    has_valid_conversation: boolean | null;
    call_duration_seconds: number | null;
  } | null;
}

function isWellFormedEntry(e: any): boolean {
  return (
    e &&
    typeof e === 'object' &&
    !Array.isArray(e) &&
    typeof e.question_id === 'string' &&
    typeof e.status === 'string'
  );
}

function isEligible(row: Row): boolean {
  const b = row.bookings;
  if (!b) return false;
  if (b.has_valid_conversation === false) return false;
  const dur = b.call_duration_seconds;
  if (dur != null && dur > 0 && dur < MIN_CALL_SECONDS) return false;
  const ext = row.research_extraction;
  if (!ext || typeof ext !== 'object') return false;
  let present = 0;
  for (const k of REQUIRED_EXTRACTION_FIELDS) {
    const v = (ext as any)[k];
    if (v !== null && v !== undefined && v !== '') present++;
  }
  return present >= MIN_EXTRACTION_FIELDS;
}

async function callModel(transcript: string): Promise<{
  parsed: Record<string, any> | null;
  inputTokens: number;
  outputTokens: number;
}> {
  const body = {
    model: MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: PROMPT },
      { role: 'user', content: transcript.slice(0, 80_000) },
    ],
  };
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '';
  const inputTokens = json?.usage?.prompt_tokens ?? 0;
  const outputTokens = json?.usage?.completion_tokens ?? 0;
  let parsed: any = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
    }
  }
  const rsa = parsed?.raw_script_answers;
  if (!rsa || typeof rsa !== 'object') {
    return { parsed: null, inputTokens, outputTokens };
  }
  return { parsed: rsa, inputTokens, outputTokens };
}

function normalizeEntry(id: string, raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;
  const status = String(raw.status ?? '').toLowerCase();
  const validStatus = ['answered', 'not_discussed', 'unclear'].includes(status)
    ? status
    : 'not_discussed';
  const confidence = ['high', 'medium', 'low'].includes(String(raw.confidence ?? '').toLowerCase())
    ? String(raw.confidence).toLowerCase()
    : 'low';
  const labels = Array.isArray(raw.selected_option_labels)
    ? raw.selected_option_labels.map((x: any) => String(x ?? '').trim()).filter(Boolean)
    : [];
  const rawText = typeof raw.raw_text_answer === 'string' && raw.raw_text_answer.trim()
    ? raw.raw_text_answer.trim().slice(0, 2000)
    : null;
  const scaleVal = typeof raw.scale_value === 'number' && isFinite(raw.scale_value)
    ? raw.scale_value
    : null;
  const quote = typeof raw.supporting_quote === 'string' && raw.supporting_quote.trim()
    ? raw.supporting_quote.trim().slice(0, 240)
    : null;
  const qType = typeof raw.question_type === 'string' && raw.question_type
    ? raw.question_type
    : 'open_ended';
  const qText = typeof raw.question_text === 'string' && raw.question_text
    ? raw.question_text
    : '';
  return {
    question_id: id,
    question_text: qText,
    question_type: qType,
    selected_option_labels: labels,
    raw_text_answer: rawText,
    scale_value: scaleVal,
    supporting_quote: quote,
    status: validStatus,
    confidence,
    source: ELIGIBLE_SOURCE,
    answered_at: null,
  };
}

function mergePreservePriority(
  existing: any,
  modelMap: Record<string, any>,
): { merged: Record<string, any>; wrote: number } {
  const merged: Record<string, any> = (existing && typeof existing === 'object' && !Array.isArray(existing))
    ? { ...existing }
    : {};
  let wrote = 0;
  for (const id of EXPECTED_IDS) {
    const current = merged[id];

    // Never overwrite agent_runtime or well-formed ai_extraction.
    if (isWellFormedEntry(current) && PROTECTED_SOURCES.has(String(current.source ?? ''))) {
      continue;
    }
    // Never overwrite a manual correction (forward-compatible).
    if (isWellFormedEntry(current) && (current.manually_corrected === true || current.manual_override === true)) {
      continue;
    }

    const candidate = normalizeEntry(id, modelMap[id]);
    if (!candidate) continue;

    // If the existing entry is already eligible-only and "answered", don't
    // downgrade it to not_discussed/unclear.
    if (
      isWellFormedEntry(current) &&
      String(current.source ?? '') === ELIGIBLE_SOURCE &&
      String(current.status ?? '') === 'answered' &&
      candidate.status !== 'answered'
    ) {
      continue;
    }

    merged[id] = { ...candidate, eligible_backfill_version: ELIGIBLE_VERSION };
    wrote++;
  }
  return { merged, wrote };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === '1';
  let isChained = false;
  try {
    if (req.method !== 'GET') {
      const body = await req.json().catch(() => ({}));
      isChained = body?.chained === true;
    }
  } catch (_e) { /* ignore */ }

  // Overfetch candidates: server-side filter for campaign, transcript,
  // duration/voicemail eligibility, and "not yet stamped". 3-of-5
  // extraction check is applied in-memory.
  const FETCH_LIMIT = 200;
  const { data: rows, error } = await supabase
    .from('booking_transcriptions')
    .select(
      'id, booking_id, call_transcription, research_extraction, bookings!inner(has_valid_conversation, call_duration_seconds)'
    )
    .eq('research_campaign_type', 'payment_experience')
    .not('call_transcription', 'is', null)
    .gt('call_transcription', '')
    .or('has_valid_conversation.is.null,has_valid_conversation.eq.true', { foreignTable: 'bookings' })
    .or('call_duration_seconds.is.null,call_duration_seconds.eq.0,call_duration_seconds.gte.120', { foreignTable: 'bookings' })
    .is('research_extraction->>raw_script_answers_eligible_backfill_version' as any, null)
    .order('id', { ascending: true })
    .limit(FETCH_LIMIT);

  if (error) {
    console.error('[backfill-pe-eligible] fetch error', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const all = (rows ?? []) as unknown as Row[];
  const eligibleAll = all.filter(isEligible);
  const eligible = eligibleAll.slice(0, CHUNK_SIZE);

  // First non-chained invocation: dry-run guardrail.
  if (!isChained && !dryRun) {
    // Count total uncompleted eligible candidates to sanity-check the population.
    const { data: countRows, error: countErr } = await supabase
      .from('booking_transcriptions')
      .select(
        'id, research_extraction, bookings!inner(has_valid_conversation, call_duration_seconds)'
      )
      .eq('research_campaign_type', 'payment_experience')
      .not('call_transcription', 'is', null)
      .gt('call_transcription', '')
      .or('has_valid_conversation.is.null,has_valid_conversation.eq.true', { foreignTable: 'bookings' })
      .or('call_duration_seconds.is.null,call_duration_seconds.eq.0,call_duration_seconds.gte.120', { foreignTable: 'bookings' })
      .is('research_extraction->>raw_script_answers_eligible_backfill_version' as any, null)
      .limit(1000);

    if (countErr) {
      return new Response(JSON.stringify({ error: countErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const totalEligible = (countRows ?? []).filter((r: any) => isEligible(r as Row)).length;
    console.log(`[backfill-pe-eligible] dry-run guardrail: total uncompleted eligible = ${totalEligible}`);
    if (totalEligible < 200 || totalEligible > 350) {
      console.error(`[backfill-pe-eligible] ABORT — eligible count ${totalEligible} outside guardrail [200, 350]`);
      return new Response(
        JSON.stringify({
          aborted: true,
          reason: 'eligible_count_out_of_guardrail',
          eligible_count: totalEligible,
          guardrail: { min: 200, max: 350 },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }

  if (dryRun) {
    return new Response(
      JSON.stringify({
        would_process: eligible.length,
        fetched: all.length,
        eligible_in_page: eligibleAll.length,
        sample_ids: eligible.slice(0, 3).map((r) => r.id),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (eligible.length === 0) {
    return new Response(JSON.stringify({ done: true, processed: 0, fetched: all.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let processed = 0;
  let failed = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const row of eligible) {
    try {
      const { parsed, inputTokens, outputTokens } = await callModel(row.call_transcription);
      if (!parsed) {
        failed++;
        errors.push({ id: row.id, error: 'unparseable model output' });
        // Still stamp so we don't loop forever; mark as failed.
        const ext = row.research_extraction || {};
        const newExt = {
          ...ext,
          raw_script_answers_eligible_backfill_version: ELIGIBLE_VERSION,
          raw_script_answers_eligible_backfill_meta: {
            version: ELIGIBLE_VERSION,
            last_backfilled_at: new Date().toISOString(),
            model: MODEL,
            source: ELIGIBLE_SOURCE,
            service_type: SERVICE_TYPE,
            note: 'failed: unparseable model output',
          },
        };
        await supabase
          .from('booking_transcriptions')
          .update({ research_extraction: newExt })
          .eq('id', row.id);
        continue;
      }

      const ext = row.research_extraction || {};
      const { merged } = mergePreservePriority(ext.raw_script_answers, parsed);

      const newExt = {
        ...ext,
        raw_script_answers: merged,
        raw_script_answers_eligible_backfill_version: ELIGIBLE_VERSION,
        raw_script_answers_eligible_backfill_meta: {
          version: ELIGIBLE_VERSION,
          last_backfilled_at: new Date().toISOString(),
          model: MODEL,
          source: ELIGIBLE_SOURCE,
          service_type: SERVICE_TYPE,
        },
      };

      const { error: upErr } = await supabase
        .from('booking_transcriptions')
        .update({ research_extraction: newExt })
        .eq('id', row.id);
      if (upErr) {
        failed++;
        errors.push({ id: row.id, error: upErr.message });
        continue;
      }

      const estimated_cost_usd =
        (inputTokens / 1_000_000) * PRICE_IN_PER_M +
        (outputTokens / 1_000_000) * PRICE_OUT_PER_M;
      await supabase.from('api_costs').insert({
        service_type: SERVICE_TYPE,
        service_provider: 'lovable_ai',
        edge_function: EDGE_FUNCTION,
        is_internal: true,
        booking_id: row.booking_id,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd,
        metadata: { model: MODEL, eligible_backfill_version: ELIGIBLE_VERSION },
      });
      processed++;
    } catch (e: any) {
      failed++;
      errors.push({ id: row.id, error: e?.message || String(e) });
    }
  }

  // Chain only if there are more eligible candidates remaining.
  const willChain = eligibleAll.length > CHUNK_SIZE || all.length >= FETCH_LIMIT;
  if (willChain) {
    const chainPromise = new Promise<void>((resolve) => {
      setTimeout(async () => {
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/${EDGE_FUNCTION}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SERVICE_ROLE}`,
            },
            body: JSON.stringify({ chained: true }),
          });
        } catch (_e) { /* ignore */ }
        resolve();
      }, PACE_MS);
    });
    // @ts-ignore - EdgeRuntime is available in Supabase edge runtime
    try { (globalThis as any).EdgeRuntime?.waitUntil?.(chainPromise); } catch (_e) { /* ignore */ }
  }

  console.log(
    `[backfill-pe-eligible] chunk done: processed=${processed} failed=${failed} ` +
    `eligible_in_page=${eligibleAll.length} fetched=${all.length} will_chain=${willChain}`
  );

  return new Response(
    JSON.stringify({
      processed,
      failed,
      eligible_in_page: eligibleAll.length,
      fetched: all.length,
      will_chain: willChain,
      errors: errors.slice(0, 10),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
