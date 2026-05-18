// Phase 3 — Payment Experience survey_progress backfill
// Deterministic cohort: bookings.research_call_id → research_calls.campaign_id
//                       → research_campaigns.script_id = PAYMENT_SCRIPT_ID
// Only touches booking_transcriptions.survey_progress. Nothing else.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYMENT_SCRIPT_ID = 'c701a243-1c66-425a-8f79-99a290ec5b6b';
const CHUNK_SIZE = 25;
const AUDIT_LOG_FIRST_N = 5; // verbose logs for first N rows of a chunk

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

interface SurveyProgress {
  answered: number;
  total: number;
  questions_covered: number[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const body = await req.json().catch(() => ({}));
  const dryRun: boolean = body?.dryRun === true;
  const auditMode: boolean = body?.audit === true; // verbose logs for the whole chunk

  // 1) Resolve PE script questions ONCE
  const { data: scriptRow, error: scriptErr } = await supabase
    .from('research_scripts')
    .select('id, questions')
    .eq('id', PAYMENT_SCRIPT_ID)
    .maybeSingle();

  if (scriptErr || !scriptRow) {
    return new Response(JSON.stringify({ error: 'Payment Experience script not found', detail: scriptErr?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const questions: any[] = Array.isArray(scriptRow.questions) ? scriptRow.questions : [];
  if (questions.length === 0) {
    return new Response(JSON.stringify({ error: 'Payment Experience script has no questions' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (questions.length !== 16) {
    console.warn(`[BackfillPE] Expected 16 PE questions, got ${questions.length}. Proceeding with actual count.`);
  }
  const TOTAL_Q = questions.length;

  // 2) Resolve PE cohort: campaign_ids → call_ids → booking_ids
  const { data: campaigns } = await supabase
    .from('research_campaigns')
    .select('id')
    .eq('script_id', PAYMENT_SCRIPT_ID);
  const campaignIds = (campaigns || []).map((c: any) => c.id);

  if (campaignIds.length === 0) {
    return new Response(JSON.stringify({ message: 'No PE campaigns exist', processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Paginate research_calls to avoid 1000-row cap
  const callIds: string[] = [];
  {
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('research_calls')
        .select('id')
        .in('campaign_id', campaignIds)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const ids = (data || []).map((r: any) => r.id);
      callIds.push(...ids);
      if (ids.length < pageSize) break;
      from += pageSize;
    }
  }

  if (callIds.length === 0) {
    return new Response(JSON.stringify({ message: 'No PE research_calls', processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Paginate bookings — chunk callIds to keep URL length manageable
  const bookingIds: string[] = [];
  const inChunk = 100;
  for (let i = 0; i < callIds.length; i += inChunk) {
    const callSlice = callIds.slice(i, i + inChunk);
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('bookings')
        .select('id')
        .in('research_call_id', callSlice)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const ids = (data || []).map((r: any) => r.id);
      bookingIds.push(...ids);
      if (ids.length < pageSize) break;
      from += pageSize;
    }
  }

  // 3) Pull a chunk of candidate transcription rows.
  // Candidate = transcript present AND (survey_progress NULL OR total != TOTAL_Q)
  // Filter at DB level so already-correct rows do not consume the per-slice limit.
  // Deterministic ordering by (updated_at NULLS FIRST, booking_id) so retries are stable.
  const candidates: { booking_id: string; call_transcription: string; survey_progress: any }[] = [];
  const sliceSize = 100;
  const TOTAL_STR = String(TOTAL_Q);
  for (let i = 0; i < bookingIds.length && candidates.length < CHUNK_SIZE; i += sliceSize) {
    const slice = bookingIds.slice(i, i + sliceSize);
    const need = CHUNK_SIZE - candidates.length;
    const { data, error } = await supabase
      .from('booking_transcriptions')
      .select('booking_id, call_transcription, survey_progress, updated_at')
      .in('booking_id', slice)
      .not('call_transcription', 'is', null)
      .neq('call_transcription', '')
      // Either no survey_progress yet, or total != TOTAL_Q (stored as string in jsonb ->>)
      .or(`survey_progress.is.null,survey_progress->>total.neq.${TOTAL_STR}`)
      .order('updated_at', { ascending: true, nullsFirst: true })
      .order('booking_id', { ascending: true })
      .limit(need);
    if (error) {
      console.error('[BackfillPE] candidate fetch error:', error);
      continue;
    }
    for (const row of data || []) {
      candidates.push(row as any);
      if (candidates.length >= CHUNK_SIZE) break;
    }
  }
  console.log(`[BackfillPE] selected ${candidates.length} candidates from ${bookingIds.length} PE bookings`);

  // Dry-run: just report remaining work
  if (dryRun) {
    // Tally full remaining count
    let remaining = 0;
    let missingTranscript = 0;
    let alreadyCorrect = 0;
    for (let i = 0; i < bookingIds.length; i += sliceSize) {
      const slice = bookingIds.slice(i, i + sliceSize);
      const { data } = await supabase
        .from('booking_transcriptions')
        .select('booking_id, call_transcription, survey_progress')
        .in('booking_id', slice);
      for (const row of data || []) {
        const t = (row as any).call_transcription;
        const total = (row as any).survey_progress?.total;
        if (!t || t === '') missingTranscript++;
        else if (total === TOTAL_Q) alreadyCorrect++;
        else remaining++;
      }
    }
    return new Response(JSON.stringify({
      dryRun: true,
      pe_cohort_bookings: bookingIds.length,
      already_total_eq_question_count: alreadyCorrect,
      missing_transcript: missingTranscript,
      requires_ai_recompute: remaining,
      question_count: TOTAL_Q,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (candidates.length === 0) {
    return new Response(JSON.stringify({
      message: 'No more rows to process — PE backfill complete',
      processed: 0, hasMore: false,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // 4) Process chunk via Gemini Flash
  const questionList = questions.map((q: any, i: number) =>
    `${i + 1}. ${typeof q === 'string' ? q : q.text || q.question || JSON.stringify(q)}`
  ).join('\n');

  const samples: any[] = [];
  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (let idx = 0; idx < candidates.length; idx++) {
    const row = candidates[idx];
    const verbose = auditMode || idx < AUDIT_LOG_FIRST_N;
    const oldTotal = row.survey_progress?.total ?? null;

    try {
      const prompt = `You are analyzing a research survey call transcript. Determine which survey questions were covered/addressed during the call.

Here are the ${TOTAL_Q} survey questions:
${questionList}

Here is the call transcript:
${row.call_transcription.substring(0, 15000)}

Return ONLY a JSON object with:
- "answered": number of questions that were addressed/covered in the conversation
- "total": ${TOTAL_Q}
- "questions_covered": array of question numbers (1-indexed) that were covered

Be generous in matching — if the topic of a question was discussed even partially, count it as covered. Return valid JSON only, no markdown.`;

      const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!aiResp.ok) {
        const txt = await aiResp.text();
        console.error(`[BackfillPE] AI error for ${row.booking_id}: ${aiResp.status} ${txt.substring(0, 200)}`);
        failed++;
        continue;
      }

      const aiJson = await aiResp.json();
      let content = aiJson.choices?.[0]?.message?.content || '';
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      let parsed: any;
      try { parsed = JSON.parse(content); }
      catch {
        const m = content.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
        else throw new Error('Unparseable AI response');
      }

      const sp: SurveyProgress = {
        answered: Number(parsed.answered) || 0,
        total: TOTAL_Q,
        questions_covered: Array.isArray(parsed.questions_covered) ? parsed.questions_covered : [],
      };

      // ONLY survey_progress is updated. Nothing else.
      const { error: upErr } = await supabase
        .from('booking_transcriptions')
        .update({ survey_progress: sp })
        .eq('booking_id', row.booking_id);

      if (upErr) {
        console.error(`[BackfillPE] update error ${row.booking_id}:`, upErr);
        failed++;
        continue;
      }

      processed++;
      if (verbose) {
        console.log(`[BackfillPE] booking_id=${row.booking_id} old_total=${oldTotal} new_total=${sp.total} answered=${sp.answered} resolved_script_id=${PAYMENT_SCRIPT_ID}`);
      }
      if (samples.length < 5) {
        samples.push({
          booking_id: row.booking_id,
          old_survey_progress_total: oldTotal,
          new_survey_progress_total: sp.total,
          new_answered: sp.answered,
          resolved_script_id: PAYMENT_SCRIPT_ID,
        });
      }

      // Small pacing delay
      await new Promise(r => setTimeout(r, 250));
    } catch (e) {
      console.error(`[BackfillPE] exception ${row.booking_id}:`, e instanceof Error ? e.message : e);
      failed++;
    }
  }

  // 5) Self-retrigger if a full chunk was processed (more work likely remains)
  const hasMore = candidates.length >= CHUNK_SIZE;
  if (hasMore) {
    EdgeRuntime.waitUntil(
      fetch(`${supabaseUrl}/functions/v1/backfill-payment-experience-progress`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(() => undefined).catch((e) => console.error('[BackfillPE] self-retrigger failed', e))
    );
  }

  return new Response(JSON.stringify({
    chunk_size: candidates.length,
    processed, failed, skipped,
    samples,
    hasMore,
    question_count: TOTAL_Q,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
