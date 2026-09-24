// supabase/functions/persist-research-raw-answers/index.ts
// Atomic, service-role merge of normalized raw_script_answers into the
// `booking_transcriptions.research_extraction` JSON of the booking linked
// to a given research_call_id. Existing keys are preserved (incoming keys
// only fill missing slots) to avoid clobbering AI-extracted answers.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, requireUser, RESEARCH } from '../_shared/auth.ts';

// Same routing rule as process-research-record (RES-16): label rows by their script.
const ROUTE_SCRIPT_ID_MAP: Record<string, string> = {
  '6397bb7f-ac6a-49ea-90ad-9ca6ec046434': 'move_out_survey',
  'c701a243-1c66-425a-8f79-99a290ec5b6b': 'payment_experience',
};
function resolveResearchCampaignType(script: { id: string; slug?: string | null } | null): string | null {
  if (!script?.id) return null;
  if (ROUTE_SCRIPT_ID_MAP[script.id]) return ROUTE_SCRIPT_ID_MAP[script.id];
  if (script.slug && ['payment_experience', 'audience_survey'].includes(script.slug)) return script.slug;
  return script.slug || `script_${String(script.id).slice(0, 8)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireUser(req, RESEARCH);
    if (!auth.ok) return auth.response;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const body = await req.json().catch(() => ({}));
    const { research_call_id, raw_script_answers } = body || {};
    if (!research_call_id || typeof research_call_id !== 'string') {
      return new Response(JSON.stringify({ error: 'research_call_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!raw_script_answers || typeof raw_script_answers !== 'object' || Array.isArray(raw_script_answers)) {
      return new Response(JSON.stringify({ error: 'raw_script_answers must be an object' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (auth.ctx.role === 'researcher') {
      const { data: rc, error: rcErr } = await admin
        .from('research_calls')
        .select('researcher_id')
        .eq('id', research_call_id)
        .maybeSingle();
      if (rcErr || !rc || rc.researcher_id !== auth.ctx.userId) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const json = (b: unknown, status = 200) =>
      new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Load the research call (service role).
    const { data: call, error: callErr } = await admin
      .from('research_calls')
      .select('id, campaign_id, researcher_id, caller_name, caller_phone, researcher_notes, call_duration_seconds, language, call_outcome')
      .eq('id', research_call_id)
      .maybeSingle();
    if (callErr) {
      console.error('persist-raw-answers: call lookup failed', callErr.message);
      return json({ error: 'Lookup failed' }, 500);
    }
    if (!call) return json({ error: 'Research call not found' }, 404);

    // Find the booking for this research call.
    const { data: foundBooking, error: bookErr } = await admin
      .from('bookings')
      .select('id')
      .eq('research_call_id', research_call_id)
      .maybeSingle();

    if (bookErr) {
      console.error('persist-raw-answers: booking lookup failed', bookErr.message);
      return json({ error: 'Lookup failed' }, 500);
    }

    let booking: { id: string } | null = foundBooking;
    let createdBooking = false;

    if (!booking) {
      // (a) Link an API-submitted booking for the same phone number.
      const digits = String(call.caller_phone || '').replace(/\D/g, '').slice(-10);
      if (digits) {
        const { data: candidates } = await admin
          .from('bookings')
          .select('id, member_name, import_batch_id')
          .eq('record_type', 'research')
          .is('research_call_id', null)
          .ilike('contact_phone', `%${digits}`)
          .order('created_at', { ascending: false })
          .limit(5);
        const match = (candidates || []).find((b: any) =>
          b.member_name?.startsWith('API Submission') || b.import_batch_id === 'api-submission'
        );
        if (match) {
          const { error: linkErr } = await admin.from('bookings').update({
            member_name: call.caller_name,
            research_call_id: call.id,
            notes: call.researcher_notes || null,
            call_duration_seconds: call.call_duration_seconds || null,
          }).eq('id', match.id);
          if (linkErr) console.error('persist-raw-answers: link failed', linkErr.message);
          else booking = { id: match.id };
        }
      }

      // (b) Otherwise create the research booking (completed or unknown outcome only).
      if (!booking && (call.call_outcome === 'completed' || call.call_outcome == null)) {
        const { data: anyAgent } = await admin
          .from('agents')
          .select('id')
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        if (anyAgent) {
          const today = new Date().toISOString().split('T')[0];
          const { data: inserted, error: insErr } = await admin.from('bookings').insert({
            record_type: 'research',
            research_call_id: call.id,
            member_name: call.caller_name,
            booking_date: today,
            move_in_date: today,
            booking_type: 'Research',
            status: 'Research',
            agent_id: anyAgent.id,
            contact_phone: call.caller_phone || null,
            created_by: auth.ctx.userId,
            notes: call.researcher_notes || null,
            call_duration_seconds: call.call_duration_seconds || null,
          }).select('id').single();
          if (insErr) console.error('persist-raw-answers: booking insert failed', insErr.message);
          else { booking = { id: inserted.id }; createdBooking = true; }
        }
      }
    }

    if (!booking) {
      return json({ ok: true, merged: false, reason: 'no_booking' });
    }

    // Resolve the survey label from the call's script (non-fatal).
    let routedType: string | null = null;
    try {
      if (call.campaign_id) {
        const { data: routeCampaign } = await admin
          .from('research_campaigns').select('script_id').eq('id', call.campaign_id).maybeSingle();
        if (routeCampaign?.script_id) {
          const { data: routeScript } = await admin
            .from('research_scripts').select('id, slug').eq('id', routeCampaign.script_id).maybeSingle();
          routedType = resolveResearchCampaignType(routeScript ?? null);
        }
      }
    } catch (e) {
      console.error('persist-raw-answers: campaign type resolve failed', e instanceof Error ? e.message : 'unknown');
      routedType = null;
    }

    const { data: existing } = await admin
      .from('booking_transcriptions')
      .select('id, research_extraction, research_campaign_type')
      .eq('booking_id', booking.id)
      .maybeSingle();

    if (!existing) {
      const { error: tInsErr } = await admin
        .from('booking_transcriptions')
        .insert({
          booking_id: booking.id,
          research_extraction: { raw_script_answers },
          ...(routedType ? { research_campaign_type: routedType, retag_source: 'script_id_route' } : {}),
        });
      if (tInsErr) {
        console.error('persist-raw-answers: transcription insert failed', tInsErr.message);
        return json({ error: 'Update failed' }, 500);
      }
    } else {
      const currentExtraction = (existing.research_extraction || {}) as Record<string, any>;
      const currentRaw = (currentExtraction.raw_script_answers || {}) as Record<string, any>;
      // Existing keys win — never clobber an already-populated answer.
      const mergedRaw = { ...raw_script_answers, ...currentRaw };
      const nextExtraction = { ...currentExtraction, raw_script_answers: mergedRaw };

      const { error: updErr } = await admin
        .from('booking_transcriptions')
        .update({
          research_extraction: nextExtraction,
          ...(routedType && routedType !== 'move_out_survey' &&
              (existing.research_campaign_type == null || existing.research_campaign_type === 'move_out_survey')
            ? { research_campaign_type: routedType, retag_source: 'script_id_route' } : {}),
        })
        .eq('id', existing.id);

      if (updErr) {
        console.error('persist-raw-answers: update failed', updErr.message);
        return json({ error: 'Update failed' }, 500);
      }
    }

    // script_responses — idempotent per session; non-fatal.
    try {
      if (call.campaign_id) {
        const { data: campaign } = await admin
          .from('research_campaigns')
          .select('script_id')
          .eq('id', call.campaign_id)
          .maybeSingle();
        const scriptId = campaign?.script_id;
        if (scriptId) {
          const { count: existingCount } = await admin
            .from('script_responses')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', call.id);
          if (!existingCount) {
            const { data: script } = await admin
              .from('research_scripts')
              .select('questions, total_responses')
              .eq('id', scriptId)
              .maybeSingle();
            const orderById = new Map<string, number>();
            (Array.isArray(script?.questions) ? script!.questions : []).forEach((q: any, idx: number) => {
              if (q?.id !== undefined && q?.id !== null) orderById.set(String(q.id), q.order ?? idx + 1);
            });
            const rows = Object.entries(raw_script_answers as Record<string, any>).map(([key, a], idx) => {
              const qid = String(a?.question_id ?? key);
              const labels = Array.isArray(a?.selected_option_labels) ? a.selected_option_labels : null;
              const numeric = typeof a?.scale_value === 'number' ? a.scale_value : null;
              const value = a?.raw_text_answer ?? (labels ? labels.join(', ') : numeric !== null ? String(numeric) : null);
              return {
                script_id: scriptId,
                session_id: call.id,
                question_order: orderById.get(qid) ?? idx + 1,
                response_value: value,
                response_options: labels,
                response_numeric: numeric,
                metadata: { question_id: qid, question_type: a?.question_type ?? null, source: 'agent_runtime', language: call.language ?? null },
              };
            });
            if (rows.length > 0) {
              const { error: srErr } = await admin.from('script_responses').insert(rows);
              if (srErr) {
                console.error('persist-raw-answers: script_responses insert failed', srErr.message);
              } else {
                await admin.from('research_scripts').update({
                  total_responses: (script?.total_responses ?? 0) + 1,
                  last_response_at: new Date().toISOString(),
                }).eq('id', scriptId);
              }
            }
          }
        }
      }
    } catch (srEx) {
      console.error('persist-raw-answers: script_responses step failed', srEx instanceof Error ? srEx.message : srEx);
    }

    return json({
      ok: true,
      merged: true,
      booking_id: booking.id,
      count: Object.keys(raw_script_answers).length,
      created_booking: createdBooking,
    });
  } catch (err) {
    console.error('persist-raw-answers: unexpected error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
