import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 500;
const FUNCTION_TIMEOUT_MS = 120000; // 2 minutes safety margin from 150s limit
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchBookingsInBatches(
  supabase: any, 
  start: string, 
  end: string,
  startTime: number
): Promise<any[]> {
  const allBookings: any[] = [];
  let offset = 0;
  let hasMore = true;
  let batchNum = 0;

  console.log(`[Pagination] Starting batch fetch for Non Booking records from ${start} to ${end}`);

  while (hasMore) {
    batchNum++;
    let retries = 0;
    let batchData: any[] | null = null;
    let lastError: Error | null = null;

    // Retry logic for each batch
    while (retries <= MAX_RETRIES && batchData === null) {
      try {
        // Check timeout before each batch
        const elapsed = Date.now() - startTime;
        if (elapsed > FUNCTION_TIMEOUT_MS) {
          throw new Error(`Function timeout approaching (${elapsed}ms elapsed, limit ${FUNCTION_TIMEOUT_MS}ms)`);
        }

        const { data, error } = await supabase
          .from('bookings')
          .select(`id, market_city, market_state, call_duration_seconds, agents (name), booking_transcriptions (call_key_points)`)
          .eq('status', 'Non Booking')
          .eq('transcription_status', 'completed')
          .gte('booking_date', start)
          .lte('booking_date', end)
          .range(offset, offset + BATCH_SIZE - 1);

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        batchData = data || [];
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        retries++;
        
        if (retries <= MAX_RETRIES) {
          console.warn(`[Pagination] Batch ${batchNum} failed (attempt ${retries}/${MAX_RETRIES + 1}): ${lastError.message}. Retrying in ${RETRY_DELAY_MS}ms...`);
          await sleep(RETRY_DELAY_MS * retries); // Exponential backoff
        }
      }
    }

    // If all retries exhausted, throw
    if (batchData === null) {
      throw new Error(`Batch ${batchNum} failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
    }

    if (batchData.length === 0) {
      hasMore = false;
      console.log(`[Pagination] No more records at offset ${offset}`);
    } else {
      allBookings.push(...batchData);
      const elapsed = Date.now() - startTime;
      console.log(`[Pagination] Batch ${batchNum}: Fetched ${batchData.length} records (total: ${allBookings.length}, elapsed: ${elapsed}ms)`);
      offset += BATCH_SIZE;
      hasMore = batchData.length === BATCH_SIZE;
    }
  }

  console.log(`[Pagination] Complete: ${allBookings.length} total records fetched in ${batchNum} batches`);
  return allBookings;
}

async function processAnalysis(url: string, key: string, apiKey: string, id: string, period: string, start: string, end: string) {
  const startTime = Date.now();
  const supabase = createClient(url, key);
  
  try {
    console.log(`[ProcessAnalysis] Starting analysis for insight ${id}`);
    
    // Phase 1: Fetch all bookings with pagination
    console.log(`[ProcessAnalysis] Phase 1: Fetching bookings...`);
    const raw = await fetchBookingsInBatches(supabase, start, end, startTime);
    
    const bookings = raw.filter((b: any) => {
      const t = Array.isArray(b.booking_transcriptions) ? b.booking_transcriptions[0] : b.booking_transcriptions;
      return t?.call_key_points;
    });

    console.log(`[ProcessAnalysis] ${bookings.length} of ${raw.length} records have call_key_points for analysis`);

    if (bookings.length === 0) {
      console.log(`[ProcessAnalysis] No transcribed calls found, marking as failed`);
      await supabase.from('non_booking_insights').update({ 
        status: 'failed', 
        error_message: 'No transcribed calls found for the selected period' 
      }).eq('id', id);
      return;
    }

    // Phase 2: Aggregate data from transcriptions
    console.log(`[ProcessAnalysis] Phase 2: Aggregating data from ${bookings.length} transcriptions...`);
    const concerns: string[] = [], objections: string[] = [], summaries: string[] = [];
    const sentiment = { positive: 0, neutral: 0, negative: 0 };
    const readiness = { high: 0, medium: 0, low: 0 };
    const markets: Record<string, { count: number; concerns: string[]; objections: string[] }> = {};
    const agents: Record<string, { count: number; objections: string[]; concerns: string[] }> = {};
    let dur = 0, durCount = 0;

    for (const b of bookings as any[]) {
      const t = Array.isArray(b.booking_transcriptions) ? b.booking_transcriptions[0] : b.booking_transcriptions;
      const kp = t?.call_key_points;
      if (!kp) continue;

      const mkt = `${b.market_city || 'Unknown'}, ${b.market_state || 'Unknown'}`;
      const agent = Array.isArray(b.agents) ? (b.agents[0]?.name || 'Unknown') : (b.agents?.name || 'Unknown');

      if (kp.summary) summaries.push(kp.summary);
      kp.memberConcerns?.forEach((c: string) => concerns.push(c));
      kp.objections?.forEach((o: string) => objections.push(o));
      if (kp.callSentiment) sentiment[kp.callSentiment as keyof typeof sentiment]++;
      if (kp.moveInReadiness) readiness[kp.moveInReadiness as keyof typeof readiness]++;
      if (b.call_duration_seconds > 0) { dur += b.call_duration_seconds; durCount++; }

      if (!markets[mkt]) markets[mkt] = { count: 0, concerns: [], objections: [] };
      markets[mkt].count++;
      kp.memberConcerns?.forEach((c: string) => markets[mkt].concerns.push(c));
      kp.objections?.forEach((o: string) => markets[mkt].objections.push(o));

      if (!agents[agent]) agents[agent] = { count: 0, objections: [], concerns: [] };
      agents[agent].count++;
      kp.objections?.forEach((o: string) => agents[agent].objections.push(o));
      kp.memberConcerns?.forEach((c: string) => agents[agent].concerns.push(c));
    }

    // Check timeout before AI call
    const elapsedBeforeAI = Date.now() - startTime;
    console.log(`[ProcessAnalysis] Phase 2 complete. Elapsed: ${elapsedBeforeAI}ms`);
    if (elapsedBeforeAI > FUNCTION_TIMEOUT_MS) {
      throw new Error(`Function timeout approaching before AI call (${elapsedBeforeAI}ms elapsed)`);
    }

    // Phase 3: AI Analysis
    console.log(`[ProcessAnalysis] Phase 3: Sending to AI for analysis...`);
    const total = bookings.length;
    const pct = (n: number) => Math.round((n / total) * 100);
    const top = (arr: string[]) => {
      const c: Record<string, number> = {};
      arr.forEach(i => c[i] = (c[i] || 0) + 1);
      return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
    };

    const agentBkdn: Record<string, any> = {};
    for (const [n, d] of Object.entries(agents)) {
      agentBkdn[n] = { non_booking_count: d.count, top_objection: top(d.objections), top_concern: top(d.concerns) };
    }
    const marketBkdn: Record<string, any> = {};
    for (const [m, d] of Object.entries(markets)) {
      marketBkdn[m] = { non_booking_count: d.count, top_objection: top(d.objections), top_concern: top(d.concerns) };
    }

    const prompt = `Analyze ${total} Non-Booking calls. Concerns: ${concerns.slice(0, 40).join('; ')}. Objections: ${objections.slice(0, 40).join('; ')}. Sentiment: +${sentiment.positive} =${sentiment.neutral} -${sentiment.negative}. Return JSON: {"rejection_reasons":[{"reason":"","percentage":0,"count":0}],"missed_opportunities":[{"pattern":"","count":0,"recovery_suggestion":"","urgency":"high"}],"objection_patterns":[{"objection":"","frequency":0,"suggested_response":""}],"recovery_recommendations":[{"recommendation":"","priority":"high","category":"Process"}],"agent_insights":{${Object.keys(agents).map(n => `"${n}":{"improvement_area":""}`).join(',')}},"market_insights":{${Object.keys(markets).map(m => `"${m}":{"suggested_focus":""}`).join(',')}}}`;

    let aiResponse: any;
    try {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`AI service returned ${res.status}: ${errorText}`);
      }

      aiResponse = await res.json();
    } catch (aiErr) {
      throw new Error(`AI analysis failed: ${aiErr instanceof Error ? aiErr.message : String(aiErr)}`);
    }

    const txt = aiResponse.choices?.[0]?.message?.content || '{}';
    console.log(`[ProcessAnalysis] AI response received (${txt.length} chars)`);

    let parsed: any = {};
    try {
      const match = txt.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    } catch { 
      console.warn(`[ProcessAnalysis] Failed to parse AI response, using empty object`);
      parsed = {}; 
    }

    // Merge AI insights with pre-computed factual data
    for (const [n, d] of Object.entries(agentBkdn)) {
      const ai = parsed.agent_insights?.[n] || {};
      agentBkdn[n] = { ...d, improvement_area: ai.improvement_area || 'Review calls' };
    }
    for (const [m, d] of Object.entries(marketBkdn)) {
      const ai = parsed.market_insights?.[m] || {};
      marketBkdn[m] = { ...d, suggested_focus: ai.suggested_focus || null };
    }

    // Phase 4: Save results
    console.log(`[ProcessAnalysis] Phase 4: Saving results to database...`);
    const { error: updateError } = await supabase.from('non_booking_insights').update({
      total_calls_analyzed: total,
      rejection_reasons: parsed.rejection_reasons || [],
      missed_opportunities: parsed.missed_opportunities || [],
      sentiment_distribution: { 
        positive: { count: sentiment.positive, percentage: pct(sentiment.positive) }, 
        neutral: { count: sentiment.neutral, percentage: pct(sentiment.neutral) }, 
        negative: { count: sentiment.negative, percentage: pct(sentiment.negative) } 
      },
      objection_patterns: parsed.objection_patterns || [],
      recovery_recommendations: parsed.recovery_recommendations || [],
      agent_breakdown: agentBkdn,
      market_breakdown: marketBkdn,
      avg_call_duration_seconds: durCount > 0 ? dur / durCount : 0,
      raw_analysis: txt,
      status: 'completed'
    }).eq('id', id);

    if (updateError) {
      throw new Error(`Failed to save results: ${updateError.message}`);
    }

    const totalElapsed = Date.now() - startTime;
    console.log(`[ProcessAnalysis] SUCCESS: Analysis complete for ${total} calls in ${totalElapsed}ms`);

    // Log API costs
    const inTok = Math.ceil(prompt.length / 4), outTok = Math.ceil(txt.length / 4);
    await supabase.from('api_costs').insert({
      service_provider: 'lovable_ai', 
      service_type: 'ai_non_booking_insights',
      edge_function: 'analyze-non-booking-insights', 
      input_tokens: inTok, 
      output_tokens: outTok,
      estimated_cost_usd: (inTok / 1000) * 0.00015 + (outTok / 1000) * 0.0006,
      metadata: { model: 'google/gemini-2.5-flash', total_calls: total, processing_time_ms: totalElapsed }
    });

  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    const totalElapsed = Date.now() - startTime;
    console.error(`[ProcessAnalysis] FAILED after ${totalElapsed}ms: ${errorMsg}`);
    
    try {
      await supabase.from('non_booking_insights').update({ 
        status: 'failed', 
        error_message: errorMsg 
      }).eq('id', id);
    } catch (updateErr) {
      console.error(`[ProcessAnalysis] Failed to update error status: ${updateErr}`);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    const { analysis_period, date_range_start, date_range_end } = await req.json();
    
    if (!analysis_period || !date_range_start || !date_range_end) {
      return new Response(
        JSON.stringify({ error: 'Missing required params: analysis_period, date_range_start, date_range_end' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(url, key);
    
    // Create the analysis record
    const { data, error } = await supabase
      .from('non_booking_insights')
      .insert({ 
        analysis_period, 
        date_range_start, 
        date_range_end, 
        status: 'processing' 
      })
      .select()
      .single();
      
    if (error) {
      console.error(`[Handler] Failed to create insight record: ${error.message}`);
      return new Response(
        JSON.stringify({ error: 'Failed to create analysis record' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Handler] Created insight record: ${data.id}, starting background processing`);
    
    // Start background processing
    EdgeRuntime.waitUntil(processAnalysis(url, key, apiKey, data.id, analysis_period, date_range_start, date_range_end));
    
    return new Response(
      JSON.stringify({ success: true, insight_id: data.id }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    console.error(`[Handler] Request error: ${errorMsg}`);
    return new Response(
      JSON.stringify({ error: errorMsg }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
