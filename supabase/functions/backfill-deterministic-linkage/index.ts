// Phase 1C — Deterministic Linkage Backfill (cursor-paginated)
//
// For every conversation_submissions row whose `campaign` resolves to a real
// research_campaigns row (by id OR campaign_key) AND whose linked booking has
// no research_call_id yet, this function:
//   - Inserts a research_calls row (campaign_id, caller_phone, kixie_link).
//   - Updates bookings.research_call_id to point at it.
//   - Updates booking_transcriptions.research_campaign_type to the resolved
//     value and stamps retag_source = 'script_id_route'.
//
// Pagination is deterministic: source rows are ordered by
// conversation_submissions.id ASC and the caller chains invocations using
// `cursor` = last_processed_conversation_submission_id. This guarantees no
// duplicates and no skips across calls.
//
// Body: { dryRun?: boolean, limit?: number, cursor?: string,
//         campaignFilter?: string, includeSnapshot?: boolean }
//
// Default mode is dry-run (no writes). Pass {"dryRun": false} to mutate.

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

const SCAN_PAGE = 1000;
const DEFAULT_LIMIT = 1500;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // default TRUE
    const limit: number = typeof body.limit === 'number' ? body.limit : DEFAULT_LIMIT;
    const cursor: string | null = typeof body.cursor === 'string' && body.cursor.length > 0 ? body.cursor : null;
    const campaignFilter: string | null = typeof body.campaignFilter === 'string' ? body.campaignFilter : null;
    const includeSnapshot: boolean = body.includeSnapshot === true;

    // 1) Build campaign lookup index.
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

    // 2) Pull candidate submissions with deterministic id-cursor pagination.
    type Candidate = {
      submission_id: string;
      booking_id: string;
      campaign_raw: string;
      phone: string | null;
      audio_url: string | null;
      booking_date: string | null;
      transcription_id: string | null;
      resolved: CampaignLite;
    };

    const candidates: Candidate[] = [];
    let lastSeenId: string | null = cursor;
    let scannedCount = 0;
    let exhausted = false;

    while (candidates.length < limit) {
      let q = supabase
        .from('conversation_submissions')
        .select('id, booking_id, campaign, phone_number, audio_url, bookings(booking_date, research_call_id, booking_transcriptions(id, research_campaign_type, retag_source))')
        .not('booking_id', 'is', null)
        .order('id', { ascending: true })
        .limit(SCAN_PAGE);
      if (lastSeenId) q = q.gt('id', lastSeenId);
      if (campaignFilter) q = q.eq('campaign', campaignFilter);

      const { data, error } = await q;
      if (error) throw new Error(`submissions page failed: ${error.message}`);
      if (!data || data.length === 0) { exhausted = true; break; }

      for (const row of data as any[]) {
        scannedCount++;
        lastSeenId = row.id;
        const resolved = resolveSubmissionCampaign(row.campaign);
        if (!resolved || !resolved.resolved_campaign_type) continue;
        const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;
        if (!booking) continue;
        if (booking.research_call_id) continue; // already linked
        const trans = booking.booking_transcriptions
          ? (Array.isArray(booking.booking_transcriptions) ? booking.booking_transcriptions[0] : booking.booking_transcriptions)
          : null;
        // Skip if already stamped with deterministic route (idempotent re-runs).
        if (trans?.retag_source === 'script_id_route') continue;
        candidates.push({
          submission_id: row.id,
          booking_id: row.booking_id,
          campaign_raw: row.campaign,
          phone: row.phone_number,
          audio_url: row.audio_url,
          booking_date: booking.booking_date ?? null,
          transcription_id: trans?.id ?? null,
          resolved,
        });
        if (candidates.length >= limit) break;
      }

      if (data.length < SCAN_PAGE) { exhausted = true; break; }
    }

    // 3) Aggregate proposed counts for response.
    const byResolved: Record<string, number> = {};
    for (const c of candidates) {
      const k = c.resolved.resolved_campaign_type!;
      byResolved[k] = (byResolved[k] || 0) + 1;
    }

    // Optional: cheap remaining estimate via head count past the cursor.
    let remainingEstimate: number | null = null;
    if (lastSeenId) {
      const { count } = await supabase
        .from('conversation_submissions')
        .select('id', { count: 'exact', head: true })
        .gt('id', lastSeenId)
        .not('booking_id', 'is', null);
      remainingEstimate = count ?? null;
    }

    if (dryRun) {
      return jsonResponse({
        mode: 'dry_run',
        scanned_submissions: scannedCount,
        candidates_in_chunk: candidates.length,
        by_resolved_campaign_type: byResolved,
        next_cursor: exhausted ? null : lastSeenId,
        remaining_estimate: exhausted ? 0 : remainingEstimate,
        exhausted,
        snapshot: includeSnapshot ? await snapshotCounts(supabase) : undefined,
        note: 'Dry-run only. Pass {"dryRun": false} to apply.',
      });
    }

    // 4) Write mode — small per-row updates (no bulk insert; we need 1:1 mapping).
    let insertedCalls = 0;
    let updatedBookings = 0;
    let updatedTranscriptions = 0;
    const errors: Array<{ booking_id: string; stage: string; error: string }> = [];

    for (const c of candidates) {
      const { data: callRow, error: insErr } = await supabase
        .from('research_calls')
        .insert({
          campaign_id: c.resolved.id,
          caller_phone: c.phone,
          kixie_link: c.audio_url,
          call_date: c.booking_date ?? new Date().toISOString().split('T')[0],
          caller_type: 'existing_member',
          caller_status: 'backfilled',
        })
        .select('id')
        .single();
      if (insErr || !callRow) {
        errors.push({ booking_id: c.booking_id, stage: 'research_calls.insert', error: insErr?.message ?? 'no row' });
        continue;
      }
      insertedCalls++;

      const { error: bErr } = await supabase
        .from('bookings').update({ research_call_id: callRow.id }).eq('id', c.booking_id);
      if (bErr) errors.push({ booking_id: c.booking_id, stage: 'bookings.update', error: bErr.message });
      else updatedBookings++;

      if (c.transcription_id) {
        const { error: tErr } = await supabase
          .from('booking_transcriptions')
          .update({
            research_campaign_type: c.resolved.resolved_campaign_type,
            retag_source: 'script_id_route',
          })
          .eq('id', c.transcription_id);
        if (tErr) errors.push({ booking_id: c.booking_id, stage: 'booking_transcriptions.update', error: tErr.message });
        else updatedTranscriptions++;
      }
    }

    return jsonResponse({
      mode: 'write',
      scanned_submissions: scannedCount,
      candidates_in_chunk: candidates.length,
      rows_inserted_research_calls: insertedCalls,
      rows_updated_bookings: updatedBookings,
      rows_updated_transcriptions: updatedTranscriptions,
      by_resolved_campaign_type: byResolved,
      last_processed_conversation_submission_id: lastSeenId,
      next_cursor: exhausted ? null : lastSeenId,
      remaining_estimate: exhausted ? 0 : remainingEstimate,
      exhausted,
      error_count: errors.length,
      errors: errors.slice(0, 20),
      snapshot: includeSnapshot ? await snapshotCounts(supabase) : undefined,
      audit_query: "SELECT id, booking_id FROM booking_transcriptions WHERE retag_source = 'script_id_route';",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[backfill-deterministic-linkage] Error:', msg);
    return jsonResponse({ success: false, error: msg }, 500);
  }
});

async function snapshotCounts(supabase: any) {
  const { count: rcCount } = await supabase.from('research_calls').select('*', { count: 'exact', head: true });
  const { count: linkedBookings } = await supabase
    .from('bookings').select('*', { count: 'exact', head: true })
    .eq('record_type', 'research').not('research_call_id', 'is', null);
  return {
    research_calls: rcCount ?? 0,
    bookings_with_research_call_id: linkedBookings ?? 0,
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
