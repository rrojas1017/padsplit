// Phase 1C — Deterministic Linkage Backfill (dry-run by default)
//
// For every conversation_submissions row whose `campaign` resolves to a real
// research_campaigns row (by id OR campaign_key) AND whose linked booking has
// no research_call_id yet, this function:
//   - Inserts a research_calls row (campaign_id, caller_phone, kixie_link).
//   - Updates bookings.research_call_id to point at it.
//   - Updates booking_transcriptions.research_campaign_type to the resolved
//     value and stamps retag_source = 'script_id_route'.
//
// Default mode is dry-run: NO writes, just preview counts. Pass {"dryRun": false}
// to actually mutate. Audit & rollback are documented in .lovable/plan.md.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SCRIPT_ID_MAP: Record<string, string> = {
  'c701a243-1c66-425a-8f79-99a290ec5b6b': 'payment_experience',
};

function mapCampaignType(t: string | null | undefined): string | null {
  switch (t) {
    case 'audience_survey': return 'audience_survey';
    case 'payment_experience': return 'payment_experience';
    case 'satisfaction': return 'move_out_survey';
    default: return null;
  }
}

function resolveCampaignType(script: { id: string; slug: string | null; campaign_type: string | null }): string | null {
  if (SCRIPT_ID_MAP[script.id]) return SCRIPT_ID_MAP[script.id];
  if (script.slug && ['payment_experience', 'audience_survey'].includes(script.slug)) return script.slug;
  if (script.campaign_type) return mapCampaignType(script.campaign_type);
  return null;
}

interface CampaignLite {
  id: string;
  campaign_key: string | null;
  script_id: string | null;
  resolved_campaign_type: string | null;
}

const PAGE = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // default TRUE
    const limit: number | null = typeof body.limit === 'number' ? body.limit : null;
    const campaignFilter: string | null = typeof body.campaignFilter === 'string' ? body.campaignFilter : null;

    // 1) Build campaign lookup index (id + campaign_key → campaign + script).
    const { data: campaigns, error: campErr } = await supabase
      .from('research_campaigns')
      .select('id, campaign_key, script_id');
    if (campErr) throw new Error(`research_campaigns load failed: ${campErr.message}`);

    const scriptIds = Array.from(new Set((campaigns || []).map(c => c.script_id).filter(Boolean))) as string[];
    const { data: scripts, error: scriptErr } = scriptIds.length
      ? await supabase.from('research_scripts').select('id, slug, campaign_type').in('id', scriptIds)
      : { data: [], error: null } as any;
    if (scriptErr) throw new Error(`research_scripts load failed: ${scriptErr.message}`);

    const scriptById = new Map<string, { id: string; slug: string | null; campaign_type: string | null }>(
      (scripts || []).map((s: any) => [s.id, s])
    );

    const campaignById = new Map<string, CampaignLite>();
    const campaignByKey = new Map<string, CampaignLite>();
    for (const c of (campaigns || [])) {
      const script = c.script_id ? scriptById.get(c.script_id) : null;
      const resolved = script ? resolveCampaignType(script) : null;
      const lite: CampaignLite = {
        id: c.id,
        campaign_key: c.campaign_key,
        script_id: c.script_id,
        resolved_campaign_type: resolved,
      };
      campaignById.set(c.id, lite);
      if (c.campaign_key) campaignByKey.set(c.campaign_key, lite);
    }

    function resolveSubmissionCampaign(raw: string): CampaignLite | null {
      return campaignById.get(raw) || campaignByKey.get(raw) || null;
    }

    // 2) Pull candidate submissions (paged), join booking + transcription state.
    type Candidate = {
      submission_id: string;
      booking_id: string;
      campaign_raw: string;
      phone: string | null;
      audio_url: string | null;
      booking_date: string | null;
      research_call_id: string | null;
      transcription_id: string | null;
      current_campaign_type: string | null;
      current_retag_source: string | null;
      resolved: CampaignLite;
    };

    const candidates: Candidate[] = [];
    let from = 0;
    while (true) {
      let q = supabase
        .from('conversation_submissions')
        .select('id, booking_id, campaign, phone_number, audio_url, bookings(booking_date, research_call_id, booking_transcriptions(id, research_campaign_type, retag_source))')
        .not('booking_id', 'is', null)
        .range(from, from + PAGE - 1);
      if (campaignFilter) q = q.eq('campaign', campaignFilter);
      const { data, error } = await q;
      if (error) throw new Error(`submissions page failed: ${error.message}`);
      if (!data || data.length === 0) break;

      for (const row of data as any[]) {
        const resolved = resolveSubmissionCampaign(row.campaign);
        if (!resolved || !resolved.resolved_campaign_type) continue;
        const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;
        if (!booking) continue;
        if (booking.research_call_id) continue; // already linked, skip
        const trans = booking.booking_transcriptions
          ? (Array.isArray(booking.booking_transcriptions) ? booking.booking_transcriptions[0] : booking.booking_transcriptions)
          : null;
        candidates.push({
          submission_id: row.id,
          booking_id: row.booking_id,
          campaign_raw: row.campaign,
          phone: row.phone_number,
          audio_url: row.audio_url,
          booking_date: booking.booking_date ?? null,
          research_call_id: booking.research_call_id ?? null,
          transcription_id: trans?.id ?? null,
          current_campaign_type: trans?.research_campaign_type ?? null,
          current_retag_source: trans?.retag_source ?? null,
          resolved,
        });
        if (limit && candidates.length >= limit) break;
      }
      if (limit && candidates.length >= limit) break;
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // 3) Build aggregate counts for the response.
    const byResolved: Record<string, number> = {};
    const byCurrent: Record<string, number> = {};
    const byProposed: Record<string, number> = { script_id_route: candidates.length };
    for (const c of candidates) {
      byResolved[c.resolved.resolved_campaign_type!] = (byResolved[c.resolved.resolved_campaign_type!] || 0) + 1;
      const k = c.current_campaign_type ?? 'null';
      byCurrent[k] = (byCurrent[k] || 0) + 1;
    }

    const beforeCounts = await snapshotCounts(supabase);

    if (dryRun) {
      return jsonResponse({
        mode: 'dry_run',
        expected_rows_affected: candidates.length,
        by_resolved_campaign_type: byResolved,
        by_current_transcription_campaign_type: byCurrent,
        by_proposed_retag_source: byProposed,
        before_counts: beforeCounts,
        preview_sample: candidates.slice(0, 5).map(c => ({
          booking_id: c.booking_id,
          campaign_raw: c.campaign_raw,
          resolved_to: c.resolved.resolved_campaign_type,
          current_campaign_type: c.current_campaign_type,
        })),
        note: 'Dry-run only. Pass {"dryRun": false} to apply.',
      });
    }

    // 4) Write mode: chunked apply.
    const CHUNK = 200;
    let insertedCalls = 0;
    let updatedBookings = 0;
    let updatedTranscriptions = 0;
    const errors: Array<{ booking_id: string; stage: string; error: string }> = [];

    for (let i = 0; i < candidates.length; i += CHUNK) {
      const chunk = candidates.slice(i, i + CHUNK);

      // 4a) Insert research_calls in bulk for this chunk.
      const callRows = chunk.map(c => ({
        campaign_id: c.resolved.id,
        caller_phone: c.phone,
        kixie_link: c.audio_url,
        call_date: c.booking_date ?? new Date().toISOString().split('T')[0],
        caller_type: 'member',
        caller_status: 'backfilled',
      }));
      const { data: insertedRows, error: insErr } = await supabase
        .from('research_calls')
        .insert(callRows)
        .select('id');
      if (insErr || !insertedRows || insertedRows.length !== chunk.length) {
        // Fall back to per-row inserts so partial failures don't stop the chunk.
        for (let j = 0; j < chunk.length; j++) {
          const c = chunk[j];
          const { data: row, error: e } = await supabase
            .from('research_calls')
            .insert(callRows[j])
            .select('id')
            .single();
          if (e || !row) {
            errors.push({ booking_id: c.booking_id, stage: 'research_calls.insert', error: e?.message ?? 'no row' });
            continue;
          }
          insertedCalls++;
          await applyLinkage(supabase, c, row.id, errors).then(([b, t]) => {
            updatedBookings += b;
            updatedTranscriptions += t;
          });
        }
        continue;
      }
      insertedCalls += insertedRows.length;

      // 4b) Link booking + stamp transcription per row.
      for (let j = 0; j < chunk.length; j++) {
        const c = chunk[j];
        const callId = insertedRows[j].id;
        const [b, t] = await applyLinkage(supabase, c, callId, errors);
        updatedBookings += b;
        updatedTranscriptions += t;
      }
    }

    const afterCounts = await snapshotCounts(supabase);

    return jsonResponse({
      mode: 'write',
      expected_rows_affected: candidates.length,
      rows_inserted_research_calls: insertedCalls,
      rows_updated_bookings: updatedBookings,
      rows_updated_transcriptions: updatedTranscriptions,
      by_resolved_campaign_type: byResolved,
      before_counts: beforeCounts,
      after_counts: afterCounts,
      error_count: errors.length,
      errors: errors.slice(0, 20),
      audit_query: "SELECT id, booking_id FROM booking_transcriptions WHERE retag_source = 'script_id_route';",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[backfill-deterministic-linkage] Error:', msg);
    return jsonResponse({ success: false, error: msg }, 500);
  }
});

async function applyLinkage(
  supabase: any,
  c: { booking_id: string; transcription_id: string | null; resolved: CampaignLite },
  callId: string,
  errors: Array<{ booking_id: string; stage: string; error: string }>,
): Promise<[number, number]> {
  let b = 0, t = 0;
  const { error: bErr } = await supabase
    .from('bookings')
    .update({ research_call_id: callId })
    .eq('id', c.booking_id);
  if (bErr) errors.push({ booking_id: c.booking_id, stage: 'bookings.update', error: bErr.message });
  else b = 1;

  if (c.transcription_id) {
    const { error: tErr } = await supabase
      .from('booking_transcriptions')
      .update({
        research_campaign_type: c.resolved.resolved_campaign_type,
        retag_source: 'script_id_route',
      })
      .eq('id', c.transcription_id);
    if (tErr) errors.push({ booking_id: c.booking_id, stage: 'booking_transcriptions.update', error: tErr.message });
    else t = 1;
  }
  return [b, t];
}

async function snapshotCounts(supabase: any) {
  const { count: rcCount } = await supabase.from('research_calls').select('*', { count: 'exact', head: true });
  const { count: linkedBookings } = await supabase
    .from('bookings').select('*', { count: 'exact', head: true })
    .eq('record_type', 'research').not('research_call_id', 'is', null);

  const { data: byType } = await supabase
    .from('booking_transcriptions')
    .select('research_campaign_type, retag_source');
  const txByType: Record<string, number> = {};
  const txByRetag: Record<string, number> = {};
  for (const row of (byType || []) as any[]) {
    const k = row.research_campaign_type ?? 'null';
    txByType[k] = (txByType[k] || 0) + 1;
    const r = row.retag_source ?? 'null';
    txByRetag[r] = (txByRetag[r] || 0) + 1;
  }

  return {
    research_calls: rcCount ?? 0,
    bookings_with_research_call_id: linkedBookings ?? 0,
    transcriptions_by_campaign_type: txByType,
    transcriptions_by_retag_source: txByRetag,
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
