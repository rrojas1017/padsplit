// supabase/functions/persist-research-raw-answers/index.ts
// Atomic, service-role merge of normalized raw_script_answers into the
// `booking_transcriptions.research_extraction` JSON of the booking linked
// to a given research_call_id. Existing keys are preserved (incoming keys
// only fill missing slots) to avoid clobbering AI-extracted answers.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Find the booking for this research call.
    const { data: booking, error: bookErr } = await admin
      .from('bookings')
      .select('id')
      .eq('research_call_id', research_call_id)
      .maybeSingle();

    if (bookErr) {
      console.error('persist-raw-answers: booking lookup failed', bookErr);
      return new Response(JSON.stringify({ error: 'Lookup failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!booking) {
      return new Response(JSON.stringify({ ok: true, merged: false, reason: 'no_booking' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existing } = await admin
      .from('booking_transcriptions')
      .select('id, research_extraction')
      .eq('booking_id', booking.id)
      .maybeSingle();

    if (!existing) {
      return new Response(JSON.stringify({ ok: true, merged: false, reason: 'no_transcription_row' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentExtraction = (existing.research_extraction || {}) as Record<string, any>;
    const currentRaw = (currentExtraction.raw_script_answers || {}) as Record<string, any>;
    // Existing keys win — never clobber an already-populated answer.
    const mergedRaw = { ...raw_script_answers, ...currentRaw };
    const nextExtraction = { ...currentExtraction, raw_script_answers: mergedRaw };

    const { error: updErr } = await admin
      .from('booking_transcriptions')
      .update({ research_extraction: nextExtraction })
      .eq('id', existing.id);

    if (updErr) {
      console.error('persist-raw-answers: update failed', updErr);
      return new Response(JSON.stringify({ error: 'Update failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      merged: true,
      booking_id: booking.id,
      count: Object.keys(raw_script_answers).length,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('persist-raw-answers: unexpected error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
