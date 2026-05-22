// supabase/functions/backfill-payment-experience-stated-answers/index.ts
// Self-retriggering chunked backfill for the new "stated answer" fields on
// payment_literacy_breakdown: dues_amount_stated_usd, dues_amount_stated_raw,
// amenities_mentioned, commitment_stated, commitment_stated_raw.
// Idempotent and resumable. Never overwrites populated values.
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
const MODEL = 'google/gemini-2.5-flash-lite';
const SERVICE_TYPE = 'research_payment_experience_backfill_stated_answers';

const ALLOWED_AMENITIES = new Set([
  'utilities', 'wifi', 'furniture', 'cleaning', 'laundry',
  'parking', 'trash', 'water', 'electric', 'gas',
  'none_mentioned', 'other',
]);

const ALLOWED_COMMITMENTS = new Set([
  'week_to_week', 'month_to_month',
  '30_days', '60_days', '90_days',
  '6_months', '12_months',
  'open_ended', 'other_specific',
  'unsure', 'unknown',
]);

const PROMPT = `You are extracting three pieces of information from a member call transcript for the PadSplit Member Payment Experience Survey.

Q3: "What is your weekly dues and what amenities or services are included?"
Q4: "In your own words, what is your PadSplit stay commitment — and when does it end?"

Return ONLY strict JSON, no markdown, with exactly these keys:
{
  "dues_amount_stated_usd": number or null (weekly dues USD the member states; null if not given or member is unsure),
  "dues_amount_stated_raw": "verbatim phrase containing the dues-amount answer, or 'unsure' if member said they did not know, or null if Q3 was not addressed",
  "amenities_mentioned": ["array of tokens from this fixed vocabulary only: utilities, wifi, furniture, cleaning, laundry, parking, trash, water, electric, gas, none_mentioned, other"],
  "commitment_stated": "one of: week_to_week|month_to_month|30_days|60_days|90_days|6_months|12_months|open_ended|other_specific|unsure|unknown",
  "commitment_stated_raw": "verbatim phrase containing the commitment answer, or null"
}

Normalization rules:
- Amenities: internet / Wi-Fi → wifi; power / lights → electric; all bills / everything → utilities. If member says nothing is included or doesn't mention any amenities, return ["none_mentioned"]. Use [] only if Q3 was not addressed at all.
- Commitment: "week to week / no commitment / as long as I want" → week_to_week; "30/60/90 days" or "3 months" → 30_days/60_days/90_days; "6 months" → 6_months; "a year / 12 months" → 12_months; "month to month" → month_to_month; specific dates or other concrete durations not in the list → other_specific; "I don't know / not sure" → unsure; Q4 not addressed → unknown.

Output ONLY the JSON object.`;

interface Row {
  id: string;
  booking_id: string;
  call_transcription: string;
  research_extraction: any;
}

interface Parsed {
  dues_amount_stated_usd: number | null;
  dues_amount_stated_raw: string | null;
  amenities_mentioned: string[];
  commitment_stated: string;
  commitment_stated_raw: string | null;
}

async function callModel(transcript: string): Promise<{
  parsed: Parsed | null;
  inputTokens: number;
  outputTokens: number;
}> {
  const body = {
    model: MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: PROMPT },
      { role: 'user', content: transcript.slice(0, 60_000) },
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
  let raw: any = null;
  try {
    raw = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      try { raw = JSON.parse(m[0]); } catch { /* ignore */ }
    }
  }
  if (!raw || typeof raw !== 'object') {
    return { parsed: null, inputTokens, outputTokens };
  }

  // dues_amount_stated_usd: coerce to finite number or null
  let amount: number | null = null;
  if (raw.dues_amount_stated_usd != null) {
    const n = Number(raw.dues_amount_stated_usd);
    if (Number.isFinite(n) && n >= 0) amount = n;
  }
  const amountRaw = raw.dues_amount_stated_raw == null
    ? null
    : String(raw.dues_amount_stated_raw).slice(0, 500);

  // amenities_mentioned: filter to allowed vocabulary; coerce unknowns to 'other'
  let amenities: string[] = [];
  if (Array.isArray(raw.amenities_mentioned)) {
    const seen = new Set<string>();
    for (const item of raw.amenities_mentioned) {
      const s = String(item ?? '').toLowerCase().trim();
      if (!s) continue;
      const token = ALLOWED_AMENITIES.has(s) ? s : 'other';
      if (!seen.has(token)) {
        seen.add(token);
        amenities.push(token);
      }
    }
  }

  // commitment_stated: validate; coerce invalid to 'unknown'
  let commitment = String(raw.commitment_stated ?? '').toLowerCase().trim();
  if (!ALLOWED_COMMITMENTS.has(commitment)) commitment = 'unknown';
  const commitmentRaw = raw.commitment_stated_raw == null
    ? null
    : String(raw.commitment_stated_raw).slice(0, 500);

  return {
    parsed: {
      dues_amount_stated_usd: amount,
      dues_amount_stated_raw: amountRaw,
      amenities_mentioned: amenities,
      commitment_stated: commitment,
      commitment_stated_raw: commitmentRaw,
    },
    inputTokens,
    outputTokens,
  };
}

const isMissing = (v: any) =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === '1';

  // Overfetch then client-filter for resumability.
  const { data: rows, error } = await supabase
    .from('booking_transcriptions')
    .select('id, booking_id, call_transcription, research_extraction')
    .eq('research_campaign_type', 'payment_experience')
    .not('call_transcription', 'is', null)
    .limit(CHUNK_SIZE * 4);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const eligible: Row[] = [];
  for (const r of (rows ?? []) as Row[]) {
    if (eligible.length >= CHUNK_SIZE) break;
    const t = (r.call_transcription || '').trim();
    if (!t) continue;
    const b = r.research_extraction?.payment_literacy_breakdown ?? {};
    const needsAmount = isMissing(b.dues_amount_stated_usd) && isMissing(b.dues_amount_stated_raw);
    const needsAmenities = b.amenities_mentioned == null;
    const needsCommitment = isMissing(b.commitment_stated);
    if (!needsAmount && !needsAmenities && !needsCommitment) continue;
    eligible.push(r);
  }

  if (eligible.length === 0) {
    return new Response(JSON.stringify({ done: true, processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (dryRun) {
    return new Response(
      JSON.stringify({ would_process: eligible.length, sample_ids: eligible.slice(0, 3).map((r) => r.id) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
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
        continue;
      }
      const ext = row.research_extraction || {};
      const breakdown = { ...(ext.payment_literacy_breakdown || {}) };

      // Race-safe merge: only fill keys that are currently missing.
      let changed = false;
      if (isMissing(breakdown.dues_amount_stated_usd) && parsed.dues_amount_stated_usd != null) {
        breakdown.dues_amount_stated_usd = parsed.dues_amount_stated_usd;
        changed = true;
      }
      if (isMissing(breakdown.dues_amount_stated_raw) && parsed.dues_amount_stated_raw != null) {
        breakdown.dues_amount_stated_raw = parsed.dues_amount_stated_raw;
        changed = true;
      }
      if (breakdown.amenities_mentioned == null) {
        breakdown.amenities_mentioned = parsed.amenities_mentioned;
        changed = true;
      }
      if (isMissing(breakdown.commitment_stated)) {
        breakdown.commitment_stated = parsed.commitment_stated;
        changed = true;
      }
      if (isMissing(breakdown.commitment_stated_raw) && parsed.commitment_stated_raw != null) {
        breakdown.commitment_stated_raw = parsed.commitment_stated_raw;
        changed = true;
      }

      if (changed) {
        const newExt = { ...ext, payment_literacy_breakdown: breakdown };
        const { error: upErr } = await supabase
          .from('booking_transcriptions')
          .update({ research_extraction: newExt })
          .eq('id', row.id);
        if (upErr) {
          failed++;
          errors.push({ id: row.id, error: upErr.message });
          continue;
        }
      }

      // Cost log (best-effort)
      const estimated_cost_usd =
        (inputTokens / 1_000_000) * 0.10 + (outputTokens / 1_000_000) * 0.40;
      await supabase.from('api_costs').insert({
        service_type: SERVICE_TYPE,
        service_provider: 'lovable_ai',
        edge_function: 'backfill-payment-experience-stated-answers',
        is_internal: true,
        booking_id: row.booking_id,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd,
        metadata: { model: MODEL },
      });
      processed++;
    } catch (e: any) {
      failed++;
      errors.push({ id: row.id, error: e?.message || String(e) });
    }
  }

  if (eligible.length >= CHUNK_SIZE) {
    queueMicrotask(() => {
      setTimeout(() => {
        fetch(`${SUPABASE_URL}/functions/v1/backfill-payment-experience-stated-answers`, {
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
      chunk_size: eligible.length,
      will_chain: eligible.length >= CHUNK_SIZE,
      errors: errors.slice(0, 10),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
