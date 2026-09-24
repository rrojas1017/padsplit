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
        let label: string | null = null;
        if (typeof answer === 'boolean') {
          label = answer ? 'Yes' : 'No';
        } else {
          const v = String(answer).trim().toLowerCase();
          label = v.startsWith('y') ? 'Yes' : v.startsWith('n') ? 'No' : null;
        }
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

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function hasLongString(v: unknown, max: number, depth = 0): boolean {
  if (depth > 10) return false;
  if (typeof v === 'string') return v.length > max;
  if (Array.isArray(v)) return v.some((x) => hasLongString(x, max, depth + 1));
  if (v && typeof v === 'object') return Object.values(v as Record<string, unknown>).some((x) => hasLongString(x, max, depth + 1));
  return false;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// --- Handler ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const rawBody = await req.text().catch(() => '');
    if (new TextEncoder().encode(rawBody).length > 100_000) {
      return json(413, { error: 'Payload too large' });
    }
    let body: any = {};
    try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { body = {}; }
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
      declined,
      submission_id,
    } = body || {};
    const submissionId: string | null =
      typeof submission_id === 'string' && submission_id.trim() !== '' && submission_id.length <= 100
        ? submission_id.trim() : null;

    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'token is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Abuse controls (before any DB work)
    if (responses && typeof responses === 'object' && Object.keys(responses).length > 200) {
      return json(400, { error: 'Too many responses' });
    }
    if (hasLongString(responses, 5000) || hasLongString(probeNotes, 5000) || hasLongString(agentNotes, 5000)) {
      return json(400, { error: 'Response too long' });
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
      .select('id, questions, questions_es, is_active')
      .eq('id', tokenRow.script_id)
      .maybeSingle();

    if (scriptErr || !script) {
      return new Response(JSON.stringify({ error: 'Script not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (script.is_active === false) {
      return json(409, { error: 'Script is not active' });
    }

    const questions = (language === 'es' && Array.isArray(script.questions_es) && script.questions_es.length > 0)
      ? script.questions_es
      : (Array.isArray(script.questions) ? script.questions : []);

    // PublicScriptView keys responses by question index; normalize keys to id.
    const normalizedResponses: Record<string, unknown> = {};
    const rawResponses = (responses && typeof responses === 'object') ? responses as Record<string, unknown> : {};
    (questions as any[]).forEach((q, idx) => {
      const stableId = getStableId(q, idx);
      // New client (sends submission_id) keys by stable id; old client keys by index.
      const v = submissionId
        ? (rawResponses[stableId] ?? (q?.id !== undefined ? rawResponses[String(q.id)] : undefined) ?? rawResponses[String(idx)])
        : (rawResponses[String(idx)] ?? rawResponses[stableId] ?? (q?.id !== undefined ? rawResponses[String(q.id)] : undefined));
      if (v !== undefined) normalizedResponses[stableId] = v;
    });

    const rawScriptAnswers = buildRawScriptAnswers(questions as any[], normalizedResponses);

    // Resolve a campaign for this script (most recent active one). Required by
    // the research_calls.campaign_id NOT NULL constraint.
    let { data: campaign } = await admin
      .from('research_campaigns')
      .select('id')
      .eq('script_id', script.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!campaign) {
      const fallback = await admin
        .from('research_campaigns')
        .select('id')
        .eq('script_id', script.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      campaign = fallback.data;
    }

    if (!campaign) {
      return new Response(JSON.stringify({ error: 'No campaign linked to this script' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const answeredCount = Object.keys(rawScriptAnswers).length;

    // Client fingerprint (never logged).
    const clientIp = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
    const clientHash = await sha256Hex(clientIp + (Deno.env.get('SUPABASE_URL') ?? ''));

    // Idempotency: same submission_id for this campaign returns the existing call.
    if (submissionId) {
      const { data: existing } = await admin
        .from('research_calls')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('responses->>_submission_id', submissionId)
        .limit(1)
        .maybeSingle();
      if (existing) {
        const { data: linked } = await admin
          .from('bookings').select('id').eq('research_call_id', existing.id).limit(1).maybeSingle();
        return json(200, {
          ok: true,
          research_call_id: existing.id,
          booking_id: linked?.id ?? null,
          raw_answers_count: answeredCount,
        });
      }
    }

    // Rate limits
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: tokenCount } = await admin
      .from('research_calls')
      .select('id', { count: 'exact', head: true })
      .eq('responses->>_token_id', tokenRow.id)
      .gte('created_at', hourAgo);
    if ((tokenCount ?? 0) >= 60) {
      return json(429, { error: 'Too many submissions, try again later' });
    }
    if (clientIp) {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count: clientCount } = await admin
        .from('research_calls')
        .select('id', { count: 'exact', head: true })
        .eq('responses->>_client_hash', clientHash)
        .gte('created_at', tenMinAgo);
      if ((clientCount ?? 0) >= 10) {
        return json(429, { error: 'Too many submissions, try again later' });
      }
    }

    const callOutcome = declined ? 'refused' : endedEarly ? 'ended_early' : (answeredCount === 0 ? 'refused' : 'completed');

    // Insert research_calls row (anonymous public submission).
    const enrichedResponses: Record<string, unknown> = {
      ...normalizedResponses,
      _probe_notes: probeNotes || {},
      _agent_notes: agentNotes || {},
      _early_disposition: endedEarly ? (earlyDisposition || 'ended_early') : null,
      _source: 'public_script',
      _token_id: tokenRow.id,
      _client_hash: clientHash,
      _submission_id: submissionId,
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
        call_outcome: callOutcome,
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
    if (callOutcome === 'completed') try {
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

    // script_responses rows (completed only; non-fatal).
    if (callOutcome === 'completed' && answeredCount > 0) {
      try {
        const rows = (questions as any[]).map((q, idx) => {
          const a = rawScriptAnswers[getStableId(q, idx)];
          if (!a) return null;
          const labels = a.selected_option_labels ?? null;
          const value = a.raw_text_answer ?? (labels ? labels.join(', ') : (a.scale_value != null ? String(a.scale_value) : null));
          return {
            script_id: script.id,
            session_id: callRow.id,
            question_order: typeof q?.order === 'number' ? q.order : idx,
            response_value: value,
            response_options: labels,
            response_numeric: a.scale_value ?? null,
            respondent_id: null,
            metadata: {
              question_id: a.question_id,
              question_type: a.question_type,
              source: 'public_script',
              language: language || 'en',
              token_id: tokenRow.id,
            },
          };
        }).filter(Boolean);
        if (rows.length > 0) {
          const { error: srErr } = await admin.from('script_responses').insert(rows as any[]);
          if (srErr) console.error('submit-public-script: script_responses insert failed', srErr.message);
          else {
            const { data: sc } = await admin
              .from('research_scripts').select('total_responses').eq('id', script.id).maybeSingle();
            const { error: upErr } = await admin
              .from('research_scripts')
              .update({ total_responses: (sc?.total_responses ?? 0) + 1, last_response_at: new Date().toISOString() })
              .eq('id', script.id);
            if (upErr) console.error('submit-public-script: script counter update failed', upErr.message);
          }
        }
      } catch (srEx) {
        console.error('submit-public-script: script_responses step failed', srEx);
      }
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
