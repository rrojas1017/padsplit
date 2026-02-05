import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 500;

async function fetchBookingsInBatches(supabase: any, start: string, end: string): Promise<any[]> {
  const allBookings: any[] = [];
  let offset = 0;
  let hasMore = true;

  console.log(`[Pagination] Starting batch fetch for Non Booking records from ${start} to ${end}`);

  while (hasMore) {
    const { data, error } = await supabase
      .from('bookings')
      .select(`id, market_city, market_state, call_duration_seconds, agents (name), booking_transcriptions (call_key_points)`)
      .eq('status', 'Non Booking')
      .eq('transcription_status', 'completed')
      .gte('booking_date', start)
      .lte('booking_date', end)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw new Error(`Batch fetch error at offset ${offset}: ${error.message}`);
    
    if (!data || data.length === 0) {
      hasMore = false;
      console.log(`[Pagination] No more records at offset ${offset}`);
    } else {
      allBookings.push(...data);
      console.log(`[Pagination] Fetched batch ${Math.floor(offset / BATCH_SIZE) + 1}: ${data.length} records (total: ${allBookings.length})`);
      offset += BATCH_SIZE;
      hasMore = data.length === BATCH_SIZE;
    }
  }

  console.log(`[Pagination] Complete: ${allBookings.length} total records fetched in ${Math.ceil(allBookings.length / BATCH_SIZE)} batches`);
  return allBookings;
}

async function processAnalysis(url: string, key: string, apiKey: string, id: string, period: string, start: string, end: string) {
  const supabase = createClient(url, key);
  
  try {
    const raw = await fetchBookingsInBatches(supabase, start, end);
    const bookings = raw.filter((b: any) => {
      const t = Array.isArray(b.booking_transcriptions) ? b.booking_transcriptions[0] : b.booking_transcriptions;
      return t?.call_key_points;
    });

    console.log(`[Analysis] ${bookings.length} of ${raw.length} records have call_key_points for analysis`);

    if (bookings.length === 0) {
      await supabase.from('non_booking_insights').update({ status: 'failed', error_message: 'No transcribed calls found' }).eq('id', id);
      return;
    }

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

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!res.ok) throw new Error(`AI error: ${res.status}`);
    const aiData = await res.json();
    const txt = aiData.choices?.[0]?.message?.content || '{}';

    let parsed: any = {};
    try {
      const match = txt.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    } catch { parsed = {}; }

    for (const [n, d] of Object.entries(agentBkdn)) {
      const ai = parsed.agent_insights?.[n] || {};
      agentBkdn[n] = { ...d, improvement_area: ai.improvement_area || 'Review calls' };
    }
    for (const [m, d] of Object.entries(marketBkdn)) {
      const ai = parsed.market_insights?.[m] || {};
      marketBkdn[m] = { ...d, suggested_focus: ai.suggested_focus || null };
    }

    await supabase.from('non_booking_insights').update({
      total_calls_analyzed: total,
      rejection_reasons: parsed.rejection_reasons || [],
      missed_opportunities: parsed.missed_opportunities || [],
      sentiment_distribution: { positive: { count: sentiment.positive, percentage: pct(sentiment.positive) }, neutral: { count: sentiment.neutral, percentage: pct(sentiment.neutral) }, negative: { count: sentiment.negative, percentage: pct(sentiment.negative) } },
      objection_patterns: parsed.objection_patterns || [],
      recovery_recommendations: parsed.recovery_recommendations || [],
      agent_breakdown: agentBkdn,
      market_breakdown: marketBkdn,
      avg_call_duration_seconds: durCount > 0 ? dur / durCount : 0,
      raw_analysis: txt,
      status: 'completed'
    }).eq('id', id);

    const inTok = Math.ceil(prompt.length / 4), outTok = Math.ceil(txt.length / 4);
    await supabase.from('api_costs').insert({
      service_provider: 'lovable_ai', service_type: 'ai_non_booking_insights',
      edge_function: 'analyze-non-booking-insights', input_tokens: inTok, output_tokens: outTok,
      estimated_cost_usd: (inTok / 1000) * 0.00015 + (outTok / 1000) * 0.0006,
      metadata: { model: 'google/gemini-2.5-flash', total_calls: total }
    });

  } catch (e) {
    const supabase = createClient(url, key);
    await supabase.from('non_booking_insights').update({ status: 'failed', error_message: e instanceof Error ? e.message : 'Error' }).eq('id', id);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { analysis_period, date_range_start, date_range_end } = await req.json();
    if (!analysis_period || !date_range_start || !date_range_end) {
      return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const url = Deno.env.get('SUPABASE_URL')!, key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, apiKey = Deno.env.get('LOVABLE_API_KEY')!;
    if (!apiKey) return new Response(JSON.stringify({ error: 'API key missing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('non_booking_insights').insert({ analysis_period, date_range_start, date_range_end, status: 'processing' }).select().single();
    if (error) return new Response(JSON.stringify({ error: 'Insert failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    EdgeRuntime.waitUntil(processAnalysis(url, key, apiKey, data.id, analysis_period, date_range_start, date_range_end));
    return new Response(JSON.stringify({ success: true, insight_id: data.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
