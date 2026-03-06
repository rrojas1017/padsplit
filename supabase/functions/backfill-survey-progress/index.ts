import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 20;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun === true;

  // Find research records with transcriptions but no survey_progress
  const { data: records, error } = await supabase
    .from('bookings')
    .select(`
      id, notes, has_valid_conversation,
      booking_transcriptions!inner (
        id, call_transcription, survey_progress
      )
    `)
    .eq('record_type', 'research')
    .eq('has_valid_conversation', true)
    .is('booking_transcriptions.survey_progress', null)
    .not('booking_transcriptions.call_transcription', 'is', null)
    .limit(dryRun ? 1 : BATCH_SIZE);

  if (error) {
    console.error('Query error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const total = records?.length || 0;
  console.log(`[Backfill] Found ${total} records to process${dryRun ? ' (dry run)' : ''}`);

  if (dryRun) {
    // Count total remaining
    const { count } = await supabase
      .from('bookings')
      .select('id, booking_transcriptions!inner(id)', { count: 'exact', head: true })
      .eq('record_type', 'research')
      .eq('has_valid_conversation', true)
      .is('booking_transcriptions.survey_progress', null)
      .not('booking_transcriptions.call_transcription', 'is', null);

    return new Response(JSON.stringify({ dryRun: true, remaining: count }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (total === 0) {
    return new Response(JSON.stringify({ message: 'No records to process', processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch the single research script's questions once (not per-record)
  const { data: scriptData } = await supabase
    .from('research_campaigns')
    .select('research_scripts!research_campaigns_script_id_fkey(questions)')
    .limit(1)
    .maybeSingle();

  const questions = (scriptData as any)?.research_scripts?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    console.error('[Backfill] No research script questions found in any campaign');
    return new Response(JSON.stringify({ error: 'No research script questions found' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[Backfill] Using ${questions.length} questions from research script`);

  const questionList = questions.map((q: any, i: number) =>
    `${i + 1}. ${typeof q === 'string' ? q : q.text || q.question || JSON.stringify(q)}`
  ).join('\n');

  // Return immediately, process in background
  EdgeRuntime.waitUntil((async () => {
    let processed = 0;
    let failed = 0;

    for (const record of records!) {
      try {
        const transcription = (record as any).booking_transcriptions;
        const transcript = transcription?.call_transcription;
        if (!transcript) continue;

        const surveyPrompt = `You are analyzing a research survey call transcript. Determine which survey questions were covered/addressed during the call.

Here are the ${questions.length} survey questions:
${questionList}

Here is the call transcript:
${transcript.substring(0, 15000)}

Return ONLY a JSON object with:
- "answered": number of questions that were addressed/covered in the conversation
- "total": ${questions.length}
- "questions_covered": array of question numbers (1-indexed) that were covered

Be generous in matching — if the topic of a question was discussed even partially, count it as covered. Return valid JSON only, no markdown.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: surveyPrompt }],
          }),
        });

        if (!aiResponse.ok) {
          console.error(`[Backfill] AI error for ${record.id}: ${aiResponse.status}`);
          failed++;
          continue;
        }

        const aiResult = await aiResponse.json();
        let content = aiResult.choices?.[0]?.message?.content || '';
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(content);

        const surveyProgress = {
          answered: parsed.answered || 0,
          total: parsed.total || questions.length,
          questions_covered: Array.isArray(parsed.questions_covered) ? parsed.questions_covered : [],
        };

        const { error: updateError } = await supabase
          .from('booking_transcriptions')
          .update({ survey_progress: surveyProgress })
          .eq('booking_id', record.id);

        if (updateError) {
          console.error(`[Backfill] Update error for ${record.id}:`, updateError);
          failed++;
        } else {
          processed++;
          console.log(`[Backfill] ${record.id}: ${surveyProgress.answered}/${surveyProgress.total}`);
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`[Backfill] Error processing ${record.id}:`, err);
        failed++;
      }
    }

    console.log(`[Backfill] Complete: ${processed} processed, ${failed} failed`);

    if (processed > 0) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/backfill-survey-progress`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        console.log('[Backfill] Self-retriggered for next batch');
      } catch (retriggerErr) {
        console.error('[Backfill] Self-retrigger failed:', retriggerErr);
      }
    }
  })());

  return new Response(JSON.stringify({ message: `Processing ${total} records in background`, batch: total }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
