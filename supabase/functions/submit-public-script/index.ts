// supabase/functions/submit-public-script/index.ts
// Public (token-authenticated) submission endpoint for PublicScriptView.
// Validates a script_access_tokens.token, resolves the script server-side,
// builds normalized raw_script_answers, inserts a research_calls row, then
// creates/links a research booking and merges raw_script_answers into the
// linked booking_transcriptions.research_extraction JSON.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Duplicated raw-answer builder (edge functions cannot import from src/) ---

type RawScriptAnswer = {
  question_id: string;
  question_text: string;
  ai_hint?: string | null;
  question_type: 'multiple_choice' | 'multiple_select' | 'yes_no' | 'scale' | 'open_ended';
  selected_option_labels?: string[];
  raw_text_answer?: string | null;
  scale_value?: number | null;
  answered_at?: string | null;
  source: 'agent_runtime';
};

function getStableId(q: any, idx: number): string {
  if (q?.id !== undefined && q?.id !== null && String(q.id).trim() !== '') return String(q.id);
  return `q_idx_${idx}`;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function buildRawScriptAnswers(
  questions: any[],
  responses: Record<string, unknown>,
): Record<string, RawScriptAnswer> {
  const out: Record<string, RawScriptAnswer> = {};
  if (!Array.isArray(questions)) return out;
  const answeredAt = new Date().toISOString();

  questions.forEach((q, idx) => {
    if (!q) return;
    const stableId = getStableId(q, idx);
    const answer =
      responses[stableId] ??
      (q.id !== undefined ? responses[String(q.id)] : undefined) ??
      responses[String(idx)];
    if (isEmpty(answer)) return;

    const base: RawScriptAnswer = {
      question_id: stableId,
      question_text: String(q.question ?? q.text ?? '').trim(),
      ai_hint: q.ai_extraction_hint ?? null,
      question_type: 'open_ended',
      answered_at: answeredAt,
      source: 'agent_runtime',
    };

    switch (q.type) {
      case 'multiple_choice': {
        const label = String(answer).trim();
        if (!label) return;
        base.question_type = 'multiple_choice';
        base.selected_option_labels = [label];
        break;
      }
      case 'multiple_select': {
        const labels = (Array.isArray(answer) ? answer : [answer])
          .map((x: unknown) => String(x ?? '').trim()).filter(Boolean);
        if (!labels.length) return;
        base.question_type = 'multiple_select';
        base.selected_option_labels = labels;
        break;
      }
      case 'yes_no': {
        const v = String(answer).trim().toLowerCase();
        const label = v.startsWith('y') ? 'Yes' : v.startsWith('n') ? 'No' : null;
        if (!label) return;
        base.question_type = 'yes_no';
        base.selected_option_labels = [label];
        break;
      }
      case 'scale': {
        const n = typeof answer === 'number' ? answer : Number(answer);
        if (!Number.isFinite(n)) return;
        base.question_type = 'scale';
        base.scale_value = n;
        break;
      }
      default: {
        const text = String(answer ?? '').trim();
        if (!text) return;
        base.question_type = 'open_ended';
        base.raw_text_answer = text;
      }
    }
    out[stableId] = base;
  });

  return out;
}

// --- Handler ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const body = await req.json().catch(() => ({}));
    const {
      token,
      responses,
      probeNotes,
      agentNotes,
      endedEarly,
      earlyDisposition,
      durationSeconds,
      callerName,
      language,
    } = body || {};

    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'token is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate token
    const { data: tokenRow, error: tokenErr } = await admin
      .from('script_access_tokens')
      .select('id, script_id, is_active, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (tokenErr) {
      console.error('submit-public-script: token lookup failed', tokenErr);
      return new Response(JSON.stringify({ error: 'Token lookup failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!tokenRow || !tokenRow.is_active) {
      return new Response(JSON.stringify({ error: 'Invalid or revoked token' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (tokenRow.expires_at && new Date() > new Date(tokenRow.expires_at)) {
      return new Response(JSON.stringify({ error: 'Token expired' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve script + most recent campaign for this script (if any)
    const { data: script, error: scriptErr } = await admin
      .from('research_scripts')
      .select('id, questions, questions_es')
      .eq('id', tokenRow.script_id)
      .maybeSingle();

    if (scriptErr || !script) {
      return new Response(JSON.stringify({ error: 'Script not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const questions = (language === 'es' && Array.isArray(script.questions_es) && script.questions_es.length > 0)
      ? script.questions_es
      : (Array.isArray(script.questions) ? script.questions : []);

    // PublicScriptView keys responses by question index; normalize keys to id.
    const normalizedResponses: Record<string, unknown> = {};
    const rawResponses = (responses && typeof responses === 'object') ? responses as Record<string, unknown> : {};
    (questions as any[]).forEach((q, idx) => {
      const stableId = getStableId(q, idx);
      const v = rawResponses[String(idx)] ?? rawResponses[stableId] ?? (q?.id !== undefined ? rawResponses[String(q.id)] : undefined);
      if (v !== undefined) normalizedResponses[stableId] = v;
    });

    const rawScriptAnswers = buildRawScriptAnswers(questions as any[], normalizedResponses);

    // Resolve a campaign for this script (most recent active one). Required by
    // the research_calls.campaign_id NOT NULL constraint.
    const { data: campaign } = await admin
      .from('research_campaigns')
      .select('id')
      .eq('script_id', script.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!campaign) {
      return new Response(JSON.stringify({ error: 'No campaign linked to this script' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert research_calls row (anonymous public submission).
    const enrichedResponses: Record<string, unknown> = {
      ...normalizedResponses,
      _probe_notes: probeNotes || {},
      _agent_notes: agentNotes || {},
      _early_disposition: endedEarly ? (earlyDisposition || 'ended_early') : null,
      _source: 'public_script',
    };

    const { data: callRow, error: callErr } = await admin
      .from('research_calls')
      .insert({
        campaign_id: campaign.id,
        researcher_id: null,
        caller_name: callerName || 'Public Submission',
        caller_phone: null,
        caller_type: 'public',
        caller_status: null,
        call_outcome: endedEarly ? 'ended_early' : 'completed',
        call_duration_seconds: typeof durationSeconds === 'number' ? durationSeconds : null,
        responses: enrichedResponses,
        language: language || 'en',
      })
      .select('id')
      .single();

    if (callErr || !callRow) {
      console.error('submit-public-script: research_calls insert failed', callErr);
      return new Response(JSON.stringify({ error: 'Failed to record submission' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a research booking and a booking_transcriptions row carrying the
    // durable raw_script_answers under research_extraction.
    let bookingId: string | null = null;
    try {
      const { data: anyAgent } = await admin
        .from('agents').select('id').eq('active', true).limit(1).maybeSingle();
      const today = new Date().toISOString().split('T')[0];

      if (anyAgent) {
        const { data: booking } = await admin
          .from('bookings')
          .insert({
            record_type: 'research',
            research_call_id: callRow.id,
            member_name: callerName || 'Public Submission',
            booking_date: today,
            move_in_date: today,
            booking_type: 'Research',
            status: 'Research',
            agent_id: anyAgent.id,
            contact_phone: null,
            call_duration_seconds: typeof durationSeconds === 'number' ? durationSeconds : null,
          })
          .select('id')
          .single();
        bookingId = booking?.id ?? null;
      }

      if (bookingId && Object.keys(rawScriptAnswers).length > 0) {
        await admin
          .from('booking_transcriptions')
          .insert({
            booking_id: bookingId,
            research_extraction: { raw_script_answers: rawScriptAnswers },
          });
      }
    } catch (bookErr) {
      console.error('submit-public-script: booking/transcription persist failed', bookErr);
      // Non-fatal — research_calls row was saved.
    }

    // Touch last_accessed_at (fire and forget).
    admin.from('script_access_tokens')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', tokenRow.id)
      .then(() => {});

    return new Response(JSON.stringify({
      ok: true,
      research_call_id: callRow.id,
      booking_id: bookingId,
      raw_answers_count: Object.keys(rawScriptAnswers).length,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('submit-public-script: unexpected error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
