// Phase 4 — Targeted repair of Move-Out-shaped PE research_extraction/classification.
// Deterministic cohort: bookings.research_call_id → research_calls.campaign_id
//                       → research_campaigns.script_id = PAYMENT_SCRIPT_ID
// Targets ONLY rows whose extraction/classification has Move-Out shape keys.
// Preserves survey_progress, transcript, summary, qa_*, coaching_*, campaign_type, retag_source.
// Clears research_extraction, research_classification, research_processing_status,
// research_processed_at — then invokes process-research-record to repopulate with PE shape.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYMENT_SCRIPT_ID = 'c701a243-1c66-425a-8f79-99a290ec5b6b';
const CHUNK_SIZE = 25;
const MOVEOUT_EXTRACTION_KEYS = ['primary_reason_code', 'trigger_type', 'would_return_to_padsplit'];
const MOVEOUT_CLASSIFICATION_KEYS = ['regrettability', 'primary_reason_code'];
const PE_EXTRACTION_SIGNAL_KEYS = ['autopay_status', 'pay_cadence', 'payment_literacy_score'];
const PE_CLASSIFICATION_SIGNAL_KEYS = ['primary_segment'];

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

function hasAnyKey(obj: any, keys: string[]): boolean {
  if (!obj || typeof obj !== 'object') return false;
  return keys.some(k => k in obj);
}

function topLevelKeys(obj: any): string[] {
  if (!obj || typeof obj !== 'object') return [];
  return Object.keys(obj).sort();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const body = await req.json().catch(() => ({}));
  const dryRun: boolean = body?.dryRun === true;

  // 1) Resolve PE cohort
  const { data: campaigns } = await supabase
    .from('research_campaigns')
    .select('id')
    .eq('script_id', PAYMENT_SCRIPT_ID);
  const campaignIds = (campaigns || []).map((c: any) => c.id);
  if (campaignIds.length === 0) {
    return new Response(JSON.stringify({ message: 'No PE campaigns', processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const callIds: string[] = [];
  {
    let from = 0; const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('research_calls').select('id')
        .in('campaign_id', campaignIds)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const ids = (data || []).map((r: any) => r.id);
      callIds.push(...ids);
      if (ids.length < pageSize) break;
      from += pageSize;
    }
  }

  const bookingIds: string[] = [];
  const inChunk = 100;
  for (let i = 0; i < callIds.length; i += inChunk) {
    const callSlice = callIds.slice(i, i + inChunk);
    let from = 0; const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('bookings').select('id')
        .in('research_call_id', callSlice)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const ids = (data || []).map((r: any) => r.id);
      bookingIds.push(...ids);
      if (ids.length < pageSize) break;
      from += pageSize;
    }
  }

  // 2) Find Move-Out-shaped candidates within PE cohort.
  // We need to use jsonb ?| operator. PostgREST: `research_extraction.cs.{...}` won't work
  // for "has any key" — use raw column filtering by fetching candidates per slice and
  // filtering in JS. Apply transcript guard at DB level.
  const sliceSize = 100;
  const allCandidates: {
    booking_id: string;
    research_extraction: any;
    research_classification: any;
    updated_at: string | null;
  }[] = [];

  for (let i = 0; i < bookingIds.length; i += sliceSize) {
    const slice = bookingIds.slice(i, i + sliceSize);
    const { data, error } = await supabase
      .from('booking_transcriptions')
      .select('booking_id, research_extraction, research_classification, call_transcription, updated_at')
      .in('booking_id', slice)
      .not('call_transcription', 'is', null);
    if (error) {
      console.error('[Phase4] fetch error:', error);
      continue;
    }
    for (const row of (data || []) as any[]) {
      const transcript: string = row.call_transcription || '';
      if (transcript.trim().length <= 100) continue; // skipped: transcript too short
      const moveoutShape =
        hasAnyKey(row.research_extraction, MOVEOUT_EXTRACTION_KEYS) ||
        hasAnyKey(row.research_classification, MOVEOUT_CLASSIFICATION_KEYS);
      if (!moveoutShape) continue;
      allCandidates.push({
        booking_id: row.booking_id,
        research_extraction: row.research_extraction,
        research_classification: row.research_classification,
        updated_at: row.updated_at,
      });
    }
  }

  // Deterministic order
  allCandidates.sort((a, b) => {
    const ua = a.updated_at || '';
    const ub = b.updated_at || '';
    if (ua !== ub) return ua < ub ? -1 : 1;
    return a.booking_id < b.booking_id ? -1 : 1;
  });

  if (dryRun) {
    const sampleIds = allCandidates.slice(0, 10).map(c => c.booking_id);
    return new Response(JSON.stringify({
      dryRun: true,
      pe_cohort_bookings: bookingIds.length,
      moveout_shaped_candidates: allCandidates.length,
      sample_ids: sampleIds,
      estimated_cost_usd: +(allCandidates.length * 0.0005).toFixed(4),
      chunk_size: CHUNK_SIZE,
      will_clear: ['research_extraction', 'research_classification', 'research_processing_status', 'research_processed_at'],
      will_preserve: ['survey_progress', 'call_transcription', 'call_summary', 'call_key_points',
        'research_campaign_type', 'retag_source', 'qa_scores', 'qa_coaching_*', 'coaching_*',
        'agent_feedback', 'stt_*', 'llm_provider'],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const chunk = allCandidates.slice(0, CHUNK_SIZE);
  if (chunk.length === 0) {
    return new Response(JSON.stringify({
      message: 'No more Move-Out-shaped PE rows — Phase 4 complete', processed: 0, hasMore: false,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let processed = 0;
  let failed = 0;
  let invalidShape = 0;
  const auditLogs: any[] = [];

  for (const row of chunk) {
    const audit: any = {
      booking_id: row.booking_id,
      old_extraction_keys: topLevelKeys(row.research_extraction),
      old_classification_keys: topLevelKeys(row.research_classification),
      new_extraction_keys: [] as string[],
      new_classification_keys: [] as string[],
      status: 'pending',
    };

    try {
      // Clear stale artifacts (preserve everything else)
      const { error: clearErr } = await supabase
        .from('booking_transcriptions')
        .update({
          research_extraction: null,
          research_classification: null,
          research_processing_status: null,
          research_processed_at: null,
        })
        .eq('booking_id', row.booking_id);

      if (clearErr) {
        audit.status = 'clear_failed';
        audit.error = clearErr.message;
        auditLogs.push(audit);
        failed++;
        continue;
      }

      // Invoke process-research-record
      const procResp = await fetch(`${supabaseUrl}/functions/v1/process-research-record`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId: row.booking_id }),
      });

      if (!procResp.ok) {
        const txt = await procResp.text();
        audit.status = 'process_failed';
        audit.error = `${procResp.status}: ${txt.substring(0, 200)}`;
        auditLogs.push(audit);
        failed++;
        continue;
      }
      await procResp.text(); // drain

      // Verify new shape
      const { data: after } = await supabase
        .from('booking_transcriptions')
        .select('research_extraction, research_classification')
        .eq('booking_id', row.booking_id)
        .maybeSingle();

      const newExt = (after as any)?.research_extraction;
      const newCls = (after as any)?.research_classification;
      audit.new_extraction_keys = topLevelKeys(newExt);
      audit.new_classification_keys = topLevelKeys(newCls);

      const stillMoveout =
        hasAnyKey(newExt, MOVEOUT_EXTRACTION_KEYS) ||
        hasAnyKey(newCls, MOVEOUT_CLASSIFICATION_KEYS);
      const hasPeSignal =
        hasAnyKey(newExt, PE_EXTRACTION_SIGNAL_KEYS) ||
        hasAnyKey(newCls, PE_CLASSIFICATION_SIGNAL_KEYS);

      if (stillMoveout || !hasPeSignal) {
        audit.status = 'invalid_shape';
        invalidShape++;
      } else {
        audit.status = 'ok';
        processed++;
      }
      auditLogs.push(audit);
      console.log('[Phase4][audit]', JSON.stringify(audit));
    } catch (e) {
      audit.status = 'exception';
      audit.error = e instanceof Error ? e.message : String(e);
      auditLogs.push(audit);
      console.error('[Phase4] exception', row.booking_id, audit.error);
      failed++;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  const hasMore = allCandidates.length > chunk.length;
  if (hasMore) {
    EdgeRuntime.waitUntil(
      fetch(`${supabaseUrl}/functions/v1/phase4-repair-pe-artifacts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'apikey': supabaseServiceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(() => undefined).catch(e => console.error('[Phase4] self-retrigger failed', e))
    );
  }

  return new Response(JSON.stringify({
    chunk_size: chunk.length,
    processed, failed, invalid_shape: invalidShape,
    remaining: Math.max(0, allCandidates.length - chunk.length),
    hasMore,
    audit: auditLogs.slice(0, 5),
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
