// supabase/functions/submit-public-script/index.ts
// Public (token-authenticated) submission endpoint for PublicScriptView.
// Validates a script_access_tokens.token, resolves the script server-side,
// builds normalized raw_script_answers, inserts a research_calls row, then
// creates/links a research booking and merges raw_script_answers into the
// linked booking_transcriptions.research_extraction JSON.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveCallStart } from '../_shared/callTime.ts';

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
      final: finalRaw,
      save_seq,
      startedAt,
    } = body || {};
    const callStart = resolveCallStart({ explicit: startedAt, audioUrl: '', maxPastMs: 24 * 60 * 60 * 1000 });
    // Old clients do not send `final` → treated as a terminal save.
    const isFinal = finalRaw === false ? false : true;
    const saveSeq: number | null =
      typeof save_seq === 'number' && Number.isInteger(save_seq) && save_seq >= 0 ? save_seq : null;
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
      .select('id, questions, questions_es, is_active, slug')
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

    const terminalOutcome = declined ? 'refused' : endedEarly ? 'ended_early' : (answeredCount === 0 ? 'refused' : 'completed');
    const totalQuestions = (questions as any[]).filter((q) => q?.is_internal !== true).length;

    const buildEnriched = (outcome: string): Record<string, unknown> => ({
      ...normalizedResponses,
      _probe_notes: probeNotes || {},
      _agent_notes: agentNotes || {},
      _early_disposition: outcome === 'ended_early' ? (earlyDisposition || 'ended_early') : null,
      _source: 'public_script',
      _token_id: tokenRow.id,
      _client_hash: clientHash,
      _submission_id: submissionId,
      _save_seq: saveSeq,
      ...(outcome !== 'in_progress' ? { _finalized_at: new Date().toISOString() } : {}),
    });

    const touchToken = () => {
      admin.from('script_access_tokens')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', tokenRow.id)
        .then(() => {});
    };

    const ok = (callId: string, status: string, bookingId: string | null, count = answeredCount) => {
      touchToken();
      return json(200, {
        ok: true,
        research_call_id: callId,
        booking_id: bookingId,
        status,
        raw_answers_count: count,
        saved_at: new Date().toISOString(),
      });
    };

    const qualifiesForBooking = (outcome: string, count: number) =>
      outcome === 'completed' || (outcome === 'ended_early' && count > 0);

    const findLinkedBooking = async (callId: string): Promise<string | null> => {
      const { data } = await admin.from('bookings').select('id').eq('research_call_id', callId).limit(1).maybeSingle();
      return data?.id ?? null;
    };

    // Booking + transcription + script_responses (+ completed counter unless repair).
    const finalizeSideEffects = async (
      callId: string,
      outcome: string,
      answers: Record<string, RawScriptAnswer>,
      opts: { repair: boolean; callerName: string | null; duration: number | null; disposition: string | null; lang: string },
    ): Promise<string | null> => {
      const count = Object.keys(answers).length;
      if (!qualifiesForBooking(outcome, count)) return null;

      let bookingId: string | null = opts.repair ? await findLinkedBooking(callId) : null;
      if (!bookingId) try {
        const { data: anyAgent } = await admin
          .from('agents').select('id').eq('active', true).limit(1).maybeSingle();
        const today = callStart.date;

        if (anyAgent) {
          const { data: booking } = await admin
            .from('bookings')
            .insert({
              record_type: 'research',
              research_call_id: callId,
              member_name: opts.callerName || 'Public Submission',
              booking_date: today,
              move_in_date: today,
              call_started_at: callStart.startedAt.toISOString(),
              booking_type: 'Research',
              status: 'Research',
              agent_id: anyAgent.id,
              contact_phone: null,
              call_duration_seconds: opts.duration,
              has_valid_conversation: true,
            })
            .select('id')
            .single();
          bookingId = booking?.id ?? null;
        }

        if (bookingId && count > 0) {
          const routedType = resolveResearchCampaignType(script);
          await admin
            .from('booking_transcriptions')
            .insert({
              booking_id: bookingId,
              research_extraction: { raw_script_answers: answers },
              survey_progress: {
                answered: count,
                total: totalQuestions,
                ended_early: outcome === 'ended_early',
                disposition: outcome === 'ended_early' ? (opts.disposition || null) : null,
                source: 'public_script',
              },
              ...(routedType ? { research_campaign_type: routedType, retag_source: 'script_id_route' } : {}),
            });
        }
      } catch (bookErr) {
        console.error('submit-public-script: booking/transcription persist failed', bookErr);
      }

      if (count > 0) {
        try {
          let skip = false;
          if (opts.repair) {
            const { count: existing } = await admin
              .from('script_responses').select('id', { count: 'exact', head: true }).eq('session_id', callId);
            skip = (existing ?? 0) > 0;
          }
          if (!skip) {
            const rows = (questions as any[]).map((q, idx) => {
              const a = answers[getStableId(q, idx)];
              if (!a) return null;
              const labels = a.selected_option_labels ?? null;
              const value = a.raw_text_answer ?? (labels ? labels.join(', ') : (a.scale_value != null ? String(a.scale_value) : null));
              return {
                script_id: script.id,
                session_id: callId,
                question_order: typeof q?.order === 'number' ? q.order : idx,
                response_value: value,
                response_options: labels,
                response_numeric: a.scale_value ?? null,
                respondent_id: null,
                metadata: {
                  question_id: a.question_id,
                  question_type: a.question_type,
                  source: 'public_script',
                  language: opts.lang,
                  token_id: tokenRow.id,
                  ...(outcome === 'ended_early' ? { partial: true } : {}),
                },
              };
            }).filter(Boolean);
            if (rows.length > 0) {
              const { error: srErr } = await admin.from('script_responses').insert(rows as any[]);
              if (srErr) console.error('submit-public-script: script_responses insert failed', srErr.message);
              else if (outcome === 'completed' && !opts.repair) {
                const { data: sc } = await admin
                  .from('research_scripts').select('total_responses').eq('id', script.id).maybeSingle();
                const { error: upErr } = await admin
                  .from('research_scripts')
                  .update({ total_responses: (sc?.total_responses ?? 0) + 1, last_response_at: new Date().toISOString() })
                  .eq('id', script.id);
                if (upErr) console.error('submit-public-script: script counter update failed', upErr.message);
              }
            }
          }
        } catch (srEx) {
          console.error('submit-public-script: script_responses step failed', srEx);
        }
      }
      return bookingId;
    };

    const currentOpts = (repair: boolean) => ({
      repair,
      callerName: callerName || null,
      duration: typeof durationSeconds === 'number' ? durationSeconds : null,
      disposition: endedEarly ? (earlyDisposition || null) : null,
      lang: language || 'en',
    });

    // Rate limit for the insert path only. Returns a 429 Response or null.
    const rateLimit = async (): Promise<Response | null> => {
      const check = async (field: string, value: string, windowMs: number, limit: number) => {
        const since = new Date(Date.now() - windowMs).toISOString();
        const { count } = await admin
          .from('research_calls')
          .select('id', { count: 'exact', head: true })
          .eq(`responses->>${field}`, value)
          .gte('created_at', since);
        if ((count ?? 0) < limit) return null;
        const { data: oldest } = await admin
          .from('research_calls')
          .select('created_at')
          .eq(`responses->>${field}`, value)
          .gte('created_at', since)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        const leaves = oldest?.created_at ? new Date(oldest.created_at).getTime() + windowMs : Date.now() + windowMs;
        return Math.max(1, Math.ceil((leaves - Date.now()) / 1000));
      };
      let retry = await check('_token_id', tokenRow.id, 60 * 60 * 1000, 600);
      if (retry === null && clientIp) retry = await check('_client_hash', clientHash, 10 * 60 * 1000, 120);
      if (retry === null) return null;
      return new Response(JSON.stringify({ error: 'Too many submissions from this office right now', retry_after: retry }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retry) },
      });
    };

    const insertRow = async (outcome: string) =>
      admin
        .from('research_calls')
        .insert({
          campaign_id: campaign.id,
          researcher_id: null,
          caller_name: callerName || 'Public Submission',
          caller_phone: null,
          caller_type: 'public',
          caller_status: null,
          call_outcome: outcome,
          call_date: callStart.date,
          call_duration_seconds: typeof durationSeconds === 'number' ? durationSeconds : null,
          responses: buildEnriched(outcome),
          language: language || 'en',
        })
        .select('id')
        .single();

    // ---- Legacy path: no submission_id → single terminal insert (as before) ----
    if (!submissionId) {
      const limited = await rateLimit();
      if (limited) return limited;
      const { data: callRow, error: callErr } = await insertRow(terminalOutcome);
      if (callErr || !callRow) {
        console.error('submit-public-script: research_calls insert failed', callErr?.message);
        return json(500, { error: 'Failed to record submission' });
      }
      const bookingId = await finalizeSideEffects(callRow.id, terminalOutcome, rawScriptAnswers, currentOpts(false));
      return ok(callRow.id, terminalOutcome, bookingId);
    }

    const readRow = async () => {
      const { data } = await admin
        .from('research_calls')
        .select('id, call_outcome, created_at, responses, caller_name, call_duration_seconds, language')
        .eq('responses->>_submission_id', submissionId)
        .limit(1)
        .maybeSingle();
      return data as any;
    };

    // Terminal row: immutable; repair side effects once if a booking is missing.
    const handleTerminal = async (row: any): Promise<Response> => {
      const stored = (row.responses && typeof row.responses === 'object') ? row.responses : {};
      const storedAnswers = buildRawScriptAnswers(questions as any[], stored);
      const count = Object.keys(storedAnswers).length;
      let bookingId = await findLinkedBooking(row.id);
      const finalizedAt = typeof stored._finalized_at === 'string' ? stored._finalized_at : null;
      const finalizedMs = finalizedAt ? new Date(finalizedAt).getTime() : null;
      const allowRepair = finalizedMs === null || Date.now() - finalizedMs > 120_000;
      if (!bookingId && qualifiesForBooking(row.call_outcome, count) && allowRepair) {
        bookingId = await finalizeSideEffects(row.id, row.call_outcome, storedAnswers, {
          repair: true,
          callerName: row.caller_name && row.caller_name !== 'Public Submission' ? row.caller_name : null,
          duration: typeof row.call_duration_seconds === 'number' ? row.call_duration_seconds : null,
          disposition: typeof stored._early_disposition === 'string' ? stored._early_disposition : null,
          lang: row.language || 'en',
        });
      }
      return ok(row.id, row.call_outcome, bookingId, count);
    };

    let row = await readRow();

    // ---- Insert path (new submission_id) ----
    if (!row) {
      const limited = await rateLimit();
      if (limited) return limited;
      const outcome = isFinal ? terminalOutcome : 'in_progress';
      const { data: callRow, error: callErr } = await insertRow(outcome);
      if (callRow) {
        if (outcome === 'in_progress') return ok(callRow.id, outcome, null);
        const bookingId = await finalizeSideEffects(callRow.id, outcome, rawScriptAnswers, currentOpts(false));
        return ok(callRow.id, outcome, bookingId);
      }
      if ((callErr as any)?.code !== '23505') {
        console.error('submit-public-script: research_calls insert failed', callErr?.message);
        return json(500, { error: 'Failed to record submission' });
      }
      // Insert race: another request created the row — continue as an update.
      row = await readRow();
      if (!row) return json(500, { error: 'Failed to record submission' });
    }

    // ---- Existing row ----
    const storedResponses = (row.responses && typeof row.responses === 'object') ? row.responses : {};
    if (storedResponses._token_id !== tokenRow.id) {
      return json(403, { error: 'Submission belongs to another link' });
    }

    if (row.call_outcome !== 'in_progress') return await handleTerminal(row);

    if (Date.now() - new Date(row.created_at).getTime() > 6 * 60 * 60 * 1000) {
      return json(409, { error: 'Submission expired' });
    }

    const updateFields = (outcome: string) => ({
      call_outcome: outcome,
      responses: buildEnriched(outcome),
      caller_name: callerName || 'Public Submission',
      call_duration_seconds: typeof durationSeconds === 'number' ? durationSeconds : null,
      language: language || 'en',
    });

    if (!isFinal) {
      const storedSeq = typeof storedResponses._save_seq === 'number' ? storedResponses._save_seq : null;
      if (saveSeq !== null && storedSeq !== null && saveSeq <= storedSeq) {
        return ok(row.id, 'in_progress', null); // stale save, ignored
      }
      const { data: upd, error: updErr } = await admin
        .from('research_calls')
        .update(updateFields('in_progress'))
        .eq('id', row.id)
        .eq('call_outcome', 'in_progress')
        .select('id');
      if (updErr) {
        console.error('submit-public-script: in_progress update failed', updErr.message);
        return json(500, { error: 'Failed to record submission' });
      }
      if (!upd || upd.length === 0) {
        const fresh = await readRow();
        return fresh ? await handleTerminal(fresh) : json(500, { error: 'Failed to record submission' });
      }
      return ok(row.id, 'in_progress', null);
    }

    // Atomic in_progress → terminal flip; only the winner runs side effects.
    const { data: flipped, error: flipErr } = await admin
      .from('research_calls')
      .update(updateFields(terminalOutcome))
      .eq('id', row.id)
      .eq('call_outcome', 'in_progress')
      .select('id');
    if (flipErr) {
      console.error('submit-public-script: terminal update failed', flipErr.message);
      return json(500, { error: 'Failed to record submission' });
    }
    if (!flipped || flipped.length === 0) {
      const fresh = await readRow();
      return fresh ? await handleTerminal(fresh) : json(500, { error: 'Failed to record submission' });
    }
    const bookingId = await finalizeSideEffects(row.id, terminalOutcome, rawScriptAnswers, currentOpts(false));
    return ok(row.id, terminalOutcome, bookingId);
  } catch (err) {
    console.error('submit-public-script: unexpected error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
