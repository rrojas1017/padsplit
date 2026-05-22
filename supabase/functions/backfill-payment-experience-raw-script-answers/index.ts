// supabase/functions/backfill-payment-experience-raw-script-answers/index.ts
// Unified, chunked, self-retriggering backfill that reconstructs the canonical
// raw_script_answers map for Payment Experience records from the call
// transcript. Merge-safe: never overwrites agent_runtime answers or existing
// well-formed ai_extraction entries.
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
const SERVICE_TYPE = 'research_payment_experience_backfill_raw_answers';
const EDGE_FUNCTION = 'backfill-payment-experience-raw-script-answers';
const BACKFILL_VERSION = 1;
const BACKFILL_SOURCE = 'ai_backfill_v1';

// gemini-2.5-flash pricing (USD per 1M tokens)
const PRICE_IN_PER_M = 0.30;
const PRICE_OUT_PER_M = 2.50;

// Canonical 17 question ids from src/utils/paymentExperienceScriptResponses.ts
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

const EXPECTED_COUNT = EXPECTED_IDS.length;

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
  "source": "ai_backfill_v1"
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

function needsBackfill(ext: any): boolean {
  if (!ext) return true;
  const rsa = ext.raw_script_answers;
  if (!rsa || typeof rsa !== 'object') return true;
  // Count canonical ids that are present AND well-formed.
  let good = 0;
  for (const id of EXPECTED_IDS) {
    if (isWellFormedEntry(rsa[id])) good++;
  }
  return good < EXPECTED_COUNT;
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
    source: BACKFILL_SOURCE,
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
    // Preserve protected, well-formed entries.
    if (isWellFormedEntry(current) && PROTECTED_SOURCES.has(String(current.source ?? ''))) {
      continue;
    }
    // Preserve an existing well-formed backfill entry from a newer version (defensive).
    if (
      isWellFormedEntry(current) &&
      current.source === BACKFILL_SOURCE &&
      Number(current.backfill_version ?? 0) > BACKFILL_VERSION
    ) {
      continue;
    }
    const candidate = normalizeEntry(id, modelMap[id]);
    if (!candidate) continue;
    merged[id] = { ...candidate, backfill_version: BACKFILL_VERSION };
    wrote++;
  }
  return { merged, wrote };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === '1';

  // Server-side filter: anything that hasn't been stamped with this backfill's
  // meta is eligible. We further filter in-memory using needsBackfill().
  // Overfetch a bit to compensate for skips.
  const FETCH_LIMIT = CHUNK_SIZE * 3;
  const { data: rows, error } = await supabase
    .from('booking_transcriptions')
    .select('id, booking_id, call_transcription, research_extraction')
    .eq('research_campaign_type', 'payment_experience')
    .not('call_transcription', 'is', null)
    .gt('call_transcription', '')
    .is('research_extraction->raw_script_answers_meta->>backfill_version' as any, null)
    .order('id', { ascending: true })
    .limit(FETCH_LIMIT);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const all = (rows ?? []) as Row[];
  const eligible = all.filter((r) => needsBackfill(r.research_extraction)).slice(0, CHUNK_SIZE);
  const skippedAlreadyComplete = all.length - eligible.length;

  if (eligible.length === 0 && all.length === 0) {
    return new Response(JSON.stringify({ done: true, processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (dryRun) {
    return new Response(
      JSON.stringify({
        would_process: eligible.length,
        fetched: all.length,
        sample_ids: eligible.slice(0, 3).map((r) => r.id),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let processed = 0;
  let failed = 0;
  let stamped = 0;
  const errors: Array<{ id: string; error: string }> = [];

  // Even rows that don't need model work need their meta stamped so they're
  // excluded from future server-side filters.
  for (const row of all) {
    if (!eligible.includes(row)) {
      // Stamp meta only (no model call).
      const ext = row.research_extraction || {};
      const newExt = {
        ...ext,
        raw_script_answers_meta: {
          backfill_version: BACKFILL_VERSION,
          last_backfilled_at: new Date().toISOString(),
          model: MODEL,
          source: BACKFILL_SOURCE,
          note: 'skipped: already complete',
        },
      };
      const { error: upErr } = await supabase
        .from('booking_transcriptions')
        .update({ research_extraction: newExt })
        .eq('id', row.id);
      if (!upErr) stamped++;
      continue;
    }

    try {
      const { parsed, inputTokens, outputTokens } = await callModel(row.call_transcription);
      if (!parsed) {
        failed++;
        errors.push({ id: row.id, error: 'unparseable model output' });
        continue;
      }

      const ext = row.research_extraction || {};
      const { merged } = mergePreservePriority(ext.raw_script_answers, parsed);

      const newExt = {
        ...ext,
        raw_script_answers: merged,
        raw_script_answers_meta: {
          backfill_version: BACKFILL_VERSION,
          last_backfilled_at: new Date().toISOString(),
          model: MODEL,
          source: BACKFILL_SOURCE,
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
        metadata: { model: MODEL, backfill_version: BACKFILL_VERSION },
      });
      processed++;
    } catch (e: any) {
      failed++;
      errors.push({ id: row.id, error: e?.message || String(e) });
    }
  }

  // Chain while the server still returns a full page of unstamped rows.
  const willChain = all.length >= CHUNK_SIZE;
  if (willChain) {
    queueMicrotask(() => {
      setTimeout(() => {
        fetch(`${SUPABASE_URL}/functions/v1/${EDGE_FUNCTION}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({ chained: true }),
        }).catch(() => { /* ignore */ });
      }, PACE_MS);
    });
  }

  return new Response(
    JSON.stringify({
      processed,
      failed,
      stamped_only: stamped,
      skipped_already_complete: skippedAlreadyComplete,
      fetched: all.length,
      will_chain: willChain,
      errors: errors.slice(0, 10),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
