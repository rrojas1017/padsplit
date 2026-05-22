// supabase/functions/backfill-payment-experience-dues-day/index.ts
// Self-retriggering chunked backfill for payment_literacy_breakdown.dues_day_stated.
// Server-side filter ensures only rows that still need work are fetched.
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
const SERVICE_TYPE = 'research_payment_experience_backfill_duesday';

const ALLOWED_DAYS = new Set([
  'monday','tuesday','wednesday','thursday','friday','saturday','sunday','unknown',
]);

const PROMPT = `You are extracting one piece of information from a member call transcript for the PadSplit Member Payment Experience Survey.

Question: "What is your payment schedule for your PadSplit room?" (i.e., what day of the week does the member say they pay PadSplit dues?)

Return ONLY strict JSON, no markdown, with exactly these keys:
{
  "dues_day_stated": "monday|tuesday|wednesday|thursday|friday|saturday|sunday|unknown",
  "dues_day_stated_raw": "the verbatim phrase from the transcript that contains the answer, or null"
}

Normalization rules:
- "every Monday", "Mondays", "on Monday", "Monday morning", "I pay on Monday" → "monday" (and likewise for tuesday..sunday).
- Member is unsure / does not know / cannot identify → "unknown".
- Transcript contains no answer to this question → "unknown".

Output ONLY the JSON object.`;

interface Row {
  id: string;
  booking_id: string;
  call_transcription: string;
  research_extraction: any;
}

async function callModel(transcript: string): Promise<{
  parsed: { dues_day_stated: string; dues_day_stated_raw: string | null } | null;
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
  let parsed: any = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { parsed: null, inputTokens, outputTokens };
  }
  let day = String(parsed.dues_day_stated ?? '').toLowerCase().trim();
  if (!ALLOWED_DAYS.has(day)) day = 'unknown';
  const raw = parsed.dues_day_stated_raw == null
    ? null
    : String(parsed.dues_day_stated_raw).slice(0, 500);
  return {
    parsed: { dues_day_stated: day, dues_day_stated_raw: raw },
    inputTokens,
    outputTokens,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === '1';

  // Server-side filter: a single .is(..., null) on the nested JSON path covers
  // all three "missing" cases — missing research_extraction, missing breakdown,
  // and missing dues_day_stated — because Postgres returns NULL for any of them
  // via the ->/->> operator chain.
  const { data: rows, error } = await supabase
    .from('booking_transcriptions')
    .select('id, booking_id, call_transcription, research_extraction')
    .eq('research_campaign_type', 'payment_experience')
    .not('call_transcription', 'is', null)
    .gt('call_transcription', '')
    .is('research_extraction->payment_literacy_breakdown->>dues_day_stated' as any, null)
    .order('id', { ascending: true })
    .limit(CHUNK_SIZE);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const fetched = (rows ?? []) as Row[];

  if (fetched.length === 0) {
    return new Response(JSON.stringify({ done: true, processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (dryRun) {
    return new Response(
      JSON.stringify({ would_process: fetched.length, sample_ids: fetched.slice(0, 3).map((r) => r.id) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let processed = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const row of fetched) {
    // Defensive: skip rows with blank transcripts (shouldn't happen after .gt filter).
    const t = (row.call_transcription || '').trim();
    if (!t) { skipped++; continue; }
    try {
      const { parsed, inputTokens, outputTokens } = await callModel(row.call_transcription);
      if (!parsed) {
        failed++;
        errors.push({ id: row.id, error: 'unparseable model output' });
        continue;
      }
      const ext = row.research_extraction || {};
      const breakdown = { ...(ext.payment_literacy_breakdown || {}) };
      // Race-safe: don't overwrite if already populated.
      if (breakdown.dues_day_stated == null || String(breakdown.dues_day_stated).trim() === '') {
        breakdown.dues_day_stated = parsed.dues_day_stated;
        breakdown.dues_day_stated_raw = parsed.dues_day_stated_raw;
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
      const estimated_cost_usd =
        (inputTokens / 1_000_000) * 0.10 + (outputTokens / 1_000_000) * 0.40;
      await supabase.from('api_costs').insert({
        service_type: SERVICE_TYPE,
        service_provider: 'lovable_ai',
        edge_function: 'backfill-payment-experience-dues-day',
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

  // Chain decision based on server-returned row count (not client filtering).
  const willChain = fetched.length >= CHUNK_SIZE;
  if (willChain) {
    queueMicrotask(() => {
      setTimeout(() => {
        fetch(`${SUPABASE_URL}/functions/v1/backfill-payment-experience-dues-day`, {
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
      skipped,
      fetched: fetched.length,
      will_chain: willChain,
      errors: errors.slice(0, 10),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
