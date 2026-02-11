import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || 50;
    const startDate = body.startDate || null;
    const endDate = body.endDate || null;
    let jobId = body.jobId || null;

    // If this is the initial call (has Authorization header), verify the user
    const authHeader = req.headers.get('Authorization');
    if (authHeader && !jobId) {
      const token = authHeader.replace('Bearer ', '');
      const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
      const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleData?.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Forbidden: super_admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Count remaining before creating job
      let initialRemaining = 0;
      try {
        let countQuery = supabase
          .from('booking_transcriptions')
          .select('id, bookings!inner(booking_date)', { count: 'exact', head: true })
          .not('call_transcription', 'is', null)
          .not('call_key_points', 'is', null)
          .is('call_key_points->lifestyleSignals', null);

        if (startDate) countQuery = countQuery.gte('bookings.booking_date', startDate);
        if (endDate) countQuery = countQuery.lte('bookings.booking_date', endDate);

        const { count } = await countQuery;
        initialRemaining = count || 0;
      } catch (e) {
        console.error('[Backfill] Error counting initial:', e);
      }

      if (initialRemaining === 0) {
        return new Response(JSON.stringify({
          success: true, jobId: null, message: 'No records to process', remaining: 0
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Create job row
      const { data: jobRow, error: jobError } = await supabase
        .from('lifestyle_backfill_jobs')
        .insert({
          status: 'running',
          start_date: startDate,
          end_date: endDate,
          remaining: initialRemaining,
          created_by: user.id,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (jobError) throw jobError;
      jobId = jobRow.id;

      // Fire self-retrigger to actually start processing (fire-and-forget)
      const selfUrl = `${supabaseUrl}/functions/v1/batch-extract-lifestyle-signals`;
      fetch(selfUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ jobId, batchSize, startDate, endDate }),
      }).catch(e => console.error('[Backfill] Self-trigger error:', e));

      // Return immediately with jobId
      return new Response(JSON.stringify({
        success: true, jobId, remaining: initialRemaining,
        message: 'Backfill started in background'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- Self-retriggered call: process one batch ----
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'No jobId provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check job status
    const { data: job } = await supabase
      .from('lifestyle_backfill_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job || job.status !== 'running') {
      console.log(`[Backfill] Job ${jobId} status is ${job?.status}, stopping.`);
      return new Response(JSON.stringify({ success: true, stopped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const MAX_DURATION_MS = 35000;
    const startTime = Date.now();
    let totalProcessed = 0;
    let totalFailed = 0;

    while (Date.now() - startTime < MAX_DURATION_MS) {
      let query = supabase
        .from('booking_transcriptions')
        .select('id, booking_id, call_transcription, call_key_points, bookings!inner(booking_date)')
        .not('call_transcription', 'is', null)
        .not('call_key_points', 'is', null)
        .is('call_key_points->lifestyleSignals', null)
        .limit(batchSize);

      if (startDate) query = query.gte('bookings.booking_date', startDate);
      if (endDate) query = query.lte('bookings.booking_date', endDate);

      const { data: candidates, error: fetchError } = await query;

      if (fetchError) {
        console.error(`[Backfill] Fetch error:`, fetchError.message);
        break;
      }

      const toProcess = candidates || [];
      if (toProcess.length === 0) break;

      console.log(`[Backfill] Processing ${toProcess.length} transcriptions (elapsed: ${Date.now() - startTime}ms)`);

      for (const record of toProcess) {
        if (Date.now() - startTime > MAX_DURATION_MS) break;

        // Re-check job status periodically (every ~10 records)
        if (totalProcessed > 0 && totalProcessed % 10 === 0) {
          const { data: freshJob } = await supabase
            .from('lifestyle_backfill_jobs')
            .select('status')
            .eq('id', jobId)
            .single();
          if (freshJob?.status !== 'running') {
            console.log(`[Backfill] Job cancelled mid-batch`);
            break;
          }
        }

        try {
          const transcription = record.call_transcription as string;
          if (!transcription || transcription.length < 50) {
            const existingKP = record.call_key_points as any;
            await supabase
              .from('booking_transcriptions')
              .update({ call_key_points: { ...existingKP, lifestyleSignals: [] } })
              .eq('id', record.id);
            totalProcessed++;
            continue;
          }

          const prompt = `Analyze this call transcript and extract ONLY lifestyle signals that indicate cross-sell or upsell opportunities.

CATEGORIES:
- healthcare: no insurance, need coverage, ACA/Obamacare, medical needs
- pet: dogs, cats, pets, pet-friendly, pet deposits
- transportation: car details, no car, rideshare, bus, transit
- home_services: furniture, cleaning, WiFi/internet, laundry, appliances
- telephony: phone plan issues, no phone service, prepaid phone
- employment: job searching, work schedule, unemployment, gig work
- financial: payment difficulties, no bank account, credit issues
- moving: moving help, storage, shipping, U-Haul

TRANSCRIPT (excerpt):
${transcription.substring(0, 6000)}

Return ONLY a JSON object (no markdown):
{
  "lifestyleSignals": [
    {
      "category": "one of the categories above",
      "signal": "exact quote or paraphrase",
      "confidence": "high | medium | low",
      "opportunity": "brief cross-sell opportunity"
    }
  ]
}

If no lifestyle signals are detected, return: {"lifestyleSignals": []}`;

          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite',
              messages: [{ role: 'user', content: prompt }],
            }),
          });

          if (!response.ok) {
            console.error(`[Backfill] AI error for ${record.booking_id}: ${response.status}`);
            totalFailed++;
            continue;
          }

          const result = await response.json();
          let content = result.choices?.[0]?.message?.content?.trim() || '';
          
          if (content.startsWith('```json')) content = content.slice(7);
          if (content.startsWith('```')) content = content.slice(3);
          if (content.endsWith('```')) content = content.slice(0, -3);
          content = content.trim();

          const parsed = JSON.parse(content);
          const signals = parsed.lifestyleSignals || [];

          const existingKeyPoints = record.call_key_points as any;
          const updatedKeyPoints = { ...existingKeyPoints, lifestyleSignals: signals };

          const { error: updateError } = await supabase
            .from('booking_transcriptions')
            .update({ 
              call_key_points: updatedKeyPoints,
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);

          if (updateError) {
            totalFailed++;
          } else {
            totalProcessed++;
          }

          await new Promise(resolve => setTimeout(resolve, 300));

        } catch (err) {
          console.error(`[Backfill] Error processing ${record.booking_id}:`, err);
          totalFailed++;
        }
      }
    }

    // Count remaining
    let remainingCount = 0;
    try {
      let countQuery = supabase
        .from('booking_transcriptions')
        .select('id, bookings!inner(booking_date)', { count: 'exact', head: true })
        .not('call_transcription', 'is', null)
        .not('call_key_points', 'is', null)
        .is('call_key_points->lifestyleSignals', null);

      if (startDate) countQuery = countQuery.gte('bookings.booking_date', startDate);
      if (endDate) countQuery = countQuery.lte('bookings.booking_date', endDate);

      const { count } = await countQuery;
      remainingCount = count || 0;
    } catch (e) {
      console.error('[Backfill] Error counting remaining:', e);
    }

    // Update job row
    const newProcessed = (job.total_processed || 0) + totalProcessed;
    const newFailed = (job.total_failed || 0) + totalFailed;
    const isComplete = remainingCount === 0;

    // Check if cancelled
    const { data: latestJob } = await supabase
      .from('lifestyle_backfill_jobs')
      .select('status')
      .eq('id', jobId)
      .single();

    const wasCancelled = latestJob?.status === 'cancelled';

    await supabase
      .from('lifestyle_backfill_jobs')
      .update({
        total_processed: newProcessed,
        total_failed: newFailed,
        remaining: remainingCount,
        ...(isComplete || wasCancelled ? {
          status: wasCancelled ? 'cancelled' : 'completed',
          completed_at: new Date().toISOString(),
        } : {}),
      })
      .eq('id', jobId);

    // Self-retrigger if more to do and not cancelled
    if (remainingCount > 0 && !wasCancelled && !isComplete) {
      const selfUrl = `${supabaseUrl}/functions/v1/batch-extract-lifestyle-signals`;
      const triggerPayload = JSON.stringify({ jobId, batchSize, startDate, endDate });
      const triggerHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      };

      let triggerOk = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const triggerRes = await fetch(selfUrl, {
            method: 'POST',
            headers: triggerHeaders,
            body: triggerPayload,
          });
          if (triggerRes.ok) {
            triggerOk = true;
            console.log(`[Backfill] Self-retriggered (attempt ${attempt + 1}). Processed ${totalProcessed} this batch, ${remainingCount} remaining.`);
            break;
          }
          console.error(`[Backfill] Self-trigger attempt ${attempt + 1} failed: ${triggerRes.status}`);
        } catch (e) {
          console.error(`[Backfill] Self-trigger attempt ${attempt + 1} error:`, e);
        }
        if (attempt === 0) await new Promise(r => setTimeout(r, 2000));
      }

      if (!triggerOk) {
        console.error('[Backfill] Self-trigger failed after 2 attempts, marking job as failed');
        await supabase
          .from('lifestyle_backfill_jobs')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('id', jobId);
      }
    } else {
      console.log(`[Backfill] Done. Total processed: ${newProcessed}, remaining: ${remainingCount}`);
    }

    return new Response(JSON.stringify({
      success: true,
      processed: newProcessed,
      failed: newFailed,
      remaining: remainingCount,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
