import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CallKeyPoints {
  summary: string;
  memberConcerns: string[];
  memberPreferences: string[];
  recommendedActions: string[];
  objections: string[];
  moveInReadiness: 'high' | 'medium' | 'low';
  callSentiment: 'positive' | 'neutral' | 'negative';
}

interface NonBookingWithTranscription {
  id: string;
  member_name: string;
  market_city: string;
  market_state: string;
  booking_date: string;
  call_duration_seconds: number | null;
  agent_id: string;
  agents?: {
    name: string;
  } | Array<{ name: string }>;
  booking_transcriptions: Array<{
    call_key_points: CallKeyPoints;
  }>;
}

// Cost logging helper
async function logApiCost(supabase: any, params: {
  service_provider: 'lovable_ai';
  service_type: string;
  edge_function: string;
  input_tokens?: number;
  output_tokens?: number;
  metadata?: Record<string, any>;
}) {
  try {
    const model = params.metadata?.model || 'google/gemini-2.5-pro';
    let inputRate = 0.00125;
    let outputRate = 0.005;
    
    const inputCost = ((params.input_tokens || 0) / 1000) * inputRate;
    const outputCost = ((params.output_tokens || 0) / 1000) * outputRate;
    const cost = inputCost + outputCost;

    await supabase.from('api_costs').insert({
      ...params,
      estimated_cost_usd: cost
    });
    console.log(`[Cost] Logged ${params.service_type}: $${cost.toFixed(4)}`);
  } catch (error) {
    console.error('[Cost] Failed to log cost:', error);
  }
}

// Background processing function
async function processNonBookingAnalysis(
  supabaseUrl: string,
  supabaseServiceKey: string,
  lovableApiKey: string,
  insightId: string,
  analysis_period: string,
  date_range_start: string,
  date_range_end: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    console.log(`[Background] Starting Non-Booking analysis for insight ${insightId}`);
    
    // Fetch all Non-Booking records with completed transcriptions in date range
    const { data: bookingsRaw, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id, 
        member_name, 
        market_city, 
        market_state,
        booking_date,
        call_duration_seconds,
        agent_id,
        agents (
          name
        ),
        booking_transcriptions (
          call_key_points
        )
      `)
      .eq('status', 'Non Booking')
      .eq('transcription_status', 'completed')
      .gte('booking_date', date_range_start)
      .lte('booking_date', date_range_end);

    if (bookingsError) {
      console.error('[Background] Error fetching non-bookings:', bookingsError);
      throw new Error(`Failed to fetch non-bookings: ${bookingsError.message}`);
    }

    console.log(`[Background] Raw non-bookings fetched: ${bookingsRaw?.length || 0}`);

    // Filter to only include records with call_key_points
    const nonBookings = (bookingsRaw || []).filter((b: any) => {
      const transcription = Array.isArray(b.booking_transcriptions) 
        ? b.booking_transcriptions[0] 
        : b.booking_transcriptions;
      return transcription?.call_key_points;
    }) as unknown as NonBookingWithTranscription[];

    console.log(`[Background] Filtered non-bookings with call_key_points: ${nonBookings.length}`);

    if (nonBookings.length === 0) {
      console.log('[Background] No transcribed non-booking calls found in date range');
      await supabase
        .from('non_booking_insights')
        .update({ 
          status: 'failed', 
          error_message: 'No transcribed Non-Booking calls found in the selected date range' 
        })
        .eq('id', insightId);
      return;
    }

    // Aggregate all call data
    const allConcerns: Array<{ text: string; booking_id: string; market: string; agent: string }> = [];
    const allObjections: Array<{ text: string; booking_id: string; market: string; agent: string }> = [];
    const allSummaries: string[] = [];
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    const readinessCounts = { high: 0, medium: 0, low: 0 };
    const marketData: Record<string, { concerns: string[], objections: string[], count: number }> = {};
    const agentData: Record<string, { nonBookingCount: number, objections: string[], concerns: string[], sentiments: string[] }> = {};
    let totalDuration = 0;
    let durationCount = 0;

    for (const booking of nonBookings) {
      const transcription = Array.isArray(booking.booking_transcriptions)
        ? booking.booking_transcriptions[0]
        : booking.booking_transcriptions;
      const keyPoints = transcription?.call_key_points;
      if (!keyPoints) continue;

      const market = `${booking.market_city || 'Unknown'}, ${booking.market_state || 'Unknown'}`;
      const agentRaw = booking.agents;
      const agentName = Array.isArray(agentRaw) ? (agentRaw[0]?.name || 'Unknown Agent') : (agentRaw?.name || 'Unknown Agent');

      // Track summary
      if (keyPoints.summary) {
        allSummaries.push(keyPoints.summary);
      }

      // Track concerns with source info
      if (keyPoints.memberConcerns) {
        for (const concern of keyPoints.memberConcerns) {
          allConcerns.push({
            text: concern,
            booking_id: booking.id,
            market,
            agent: agentName
          });
        }
      }

      // Track objections
      if (keyPoints.objections) {
        for (const obj of keyPoints.objections) {
          allObjections.push({
            text: obj,
            booking_id: booking.id,
            market,
            agent: agentName
          });
        }
      }

      // Track sentiment
      if (keyPoints.callSentiment) {
        sentimentCounts[keyPoints.callSentiment]++;
      }

      // Track readiness
      if (keyPoints.moveInReadiness) {
        readinessCounts[keyPoints.moveInReadiness]++;
      }

      // Track duration
      if (booking.call_duration_seconds && booking.call_duration_seconds > 0) {
        totalDuration += booking.call_duration_seconds;
        durationCount++;
      }

      // Track by market
      const marketKey = market;
      if (!marketData[marketKey]) {
        marketData[marketKey] = { concerns: [], objections: [], count: 0 };
      }
      marketData[marketKey].count++;
      if (keyPoints.memberConcerns) marketData[marketKey].concerns.push(...keyPoints.memberConcerns);
      if (keyPoints.objections) marketData[marketKey].objections.push(...keyPoints.objections);

      // Track by agent
      if (!agentData[agentName]) {
        agentData[agentName] = { nonBookingCount: 0, objections: [], concerns: [], sentiments: [] };
      }
      agentData[agentName].nonBookingCount++;
      if (keyPoints.objections) agentData[agentName].objections.push(...keyPoints.objections);
      if (keyPoints.memberConcerns) agentData[agentName].concerns.push(...keyPoints.memberConcerns);
      if (keyPoints.callSentiment) agentData[agentName].sentiments.push(keyPoints.callSentiment);
    }

    // Calculate average call duration
    const avgCallDurationSeconds = durationCount > 0 ? totalDuration / durationCount : 0;

    const totalCalls = nonBookings.length;
    const sentimentDistribution = {
      positive: { count: sentimentCounts.positive, percentage: Math.round((sentimentCounts.positive / totalCalls) * 100) },
      neutral: { count: sentimentCounts.neutral, percentage: Math.round((sentimentCounts.neutral / totalCalls) * 100) },
      negative: { count: sentimentCounts.negative, percentage: Math.round((sentimentCounts.negative / totalCalls) * 100) }
    };

    // Pre-compute agent breakdown server-side (factual data)
    const computedAgentBreakdown: Record<string, any> = {};
    for (const [agentName, data] of Object.entries(agentData)) {
      // Find most common objection
      const objectionCounts: Record<string, number> = {};
      data.objections.forEach(obj => {
        objectionCounts[obj] = (objectionCounts[obj] || 0) + 1;
      });
      const topObjection = Object.entries(objectionCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
      
      // Find most common concern
      const concernCounts: Record<string, number> = {};
      data.concerns.forEach(c => {
        concernCounts[c] = (concernCounts[c] || 0) + 1;
      });
      const topConcern = Object.entries(concernCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

      computedAgentBreakdown[agentName] = {
        non_booking_count: data.nonBookingCount,
        top_objection: topObjection,
        top_concern: topConcern,
        total_objections: data.objections.length,
        total_concerns: data.concerns.length
      };
    }
    
    // Pre-compute market breakdown server-side (factual data)
    const computedMarketBreakdown: Record<string, any> = {};
    for (const [market, data] of Object.entries(marketData)) {
      const objectionCounts: Record<string, number> = {};
      data.objections.forEach(obj => {
        objectionCounts[obj] = (objectionCounts[obj] || 0) + 1;
      });
      const topObjection = Object.entries(objectionCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
      
      const concernCounts: Record<string, number> = {};
      data.concerns.forEach(c => {
        concernCounts[c] = (concernCounts[c] || 0) + 1;
      });
      const topConcern = Object.entries(concernCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

      computedMarketBreakdown[market] = {
        non_booking_count: data.count,
        top_objection: topObjection,
        top_concern: topConcern
      };
    }

    console.log(`[Background] Pre-computed agent breakdown for ${Object.keys(computedAgentBreakdown).length} agents`);
    console.log(`[Background] Pre-computed market breakdown for ${Object.keys(computedMarketBreakdown).length} markets`);

    // Build AI prompt for Non-Booking specific analysis
    const aiPrompt = `You are analyzing PadSplit calls that DID NOT result in a booking.
Your goal is to understand why members didn't convert and identify recovery opportunities.

CONTEXT: PadSplit offers affordable room rentals with shared living spaces.
These are calls where the member did NOT book a room.

ANALYSIS DATA FROM ${totalCalls} NON-BOOKING CALLS (${date_range_start} to ${date_range_end}):

CALL SUMMARIES (showing what happened on these non-booking calls):
${allSummaries.slice(0, 50).map((s, i) => `${i + 1}. ${s}`).join('\n')}

MEMBER CONCERNS (${allConcerns.length} total):
${allConcerns.slice(0, 80).map(c => `"${c.text}" - ${c.market}`).join('\n')}

OBJECTIONS RAISED (${allObjections.length} total):
${allObjections.slice(0, 80).map(o => `"${o.text}" - ${o.market}`).join('\n')}

SENTIMENT BREAKDOWN:
- Positive: ${sentimentCounts.positive} calls (${sentimentDistribution.positive.percentage}%)
- Neutral: ${sentimentCounts.neutral} calls (${sentimentDistribution.neutral.percentage}%)
- Negative: ${sentimentCounts.negative} calls (${sentimentDistribution.negative.percentage}%)

MOVE-IN READINESS:
- High: ${readinessCounts.high} calls (ready to book but didn't)
- Medium: ${readinessCounts.medium} calls
- Low: ${readinessCounts.low} calls

MARKET DATA:
${Object.entries(marketData).map(([market, data]) => 
  `${market}: ${data.count} non-bookings, Top concerns: ${data.concerns.slice(0, 3).join('; ')}`
).join('\n')}

AGENT DATA:
${Object.entries(agentData).map(([agent, data]) => 
  `${agent}: ${data.nonBookingCount} non-bookings, Top objection: ${data.objections[0] || 'none'}`
).join('\n')}

Analyze this NON-BOOKING data and return a JSON object with EXACTLY this structure:

{
  "rejection_reasons": [
    {
      "reason": "Product-Market Mismatch",
      "percentage": 35,
      "count": 24,
      "examples": ["Looking for a whole apartment not shared", "Don't want roommates"]
    },
    {
      "reason": "Already Found Housing",
      "percentage": 20,
      "count": 14,
      "examples": ["Already signed lease elsewhere", "Found an apartment"]
    }
  ],
  "missed_opportunities": [
    {
      "pattern": "High readiness but no immediate availability",
      "count": 12,
      "recovery_suggestion": "Follow up when units open in their preferred area",
      "urgency": "high"
    },
    {
      "pattern": "Voicemail - member didn't answer",
      "count": 8,
      "recovery_suggestion": "Automated SMS follow-up within 2 hours",
      "urgency": "medium"
    }
  ],
  "objection_patterns": [
    {
      "objection": "Pricing concerns",
      "frequency": 15,
      "percentage": 21,
      "suggested_response": "Emphasize weekly payment flexibility and no credit check",
      "examples": ["Too expensive", "Can't afford the fees"]
    }
  ],
  "recovery_recommendations": [
    {
      "recommendation": "Implement 24-hour follow-up for high-readiness voicemails",
      "priority": "high",
      "category": "Process",
      "expected_impact": "Could recover 10-15% of voicemail non-bookers"
    },
    {
      "recommendation": "Create objection handling script for shared living concerns",
      "priority": "medium",
      "category": "Training",
      "expected_impact": "Address top rejection reason more effectively"
    }
  ],
  "agent_insights": {
${Object.keys(agentData).map(name => `    "${name}": {
      "improvement_area": "Specific coaching recommendation for this agent based on their patterns",
      "pattern_observation": "Qualitative insight about this agent's non-booking calls"
    }`).join(',\n')}
  },
  "market_insights": {
${Object.keys(marketData).map(market => `    "${market}": {
      "unique_pattern": "What makes this market different",
      "suggested_focus": "Specific recommendation for this market"
    }`).join(',\n')}
  }
}

IMPORTANT: You MUST provide insights for EVERY agent and market listed above.

REQUIREMENTS:
- Focus on WHY they didn't book and HOW to recover them
- Identify high-readiness members as missed opportunities
- Percentages should be of total non-booking calls analyzed
- Include at least 4-6 rejection reasons if data supports it
- Provide actionable recovery recommendations
- Include actual verbatim quotes in examples
- Provide agent_insights for ALL ${Object.keys(agentData).length} agents listed
- Provide market_insights for ALL ${Object.keys(marketData).length} markets listed`;

    console.log('[Background] Sending data to AI for Non-Booking analysis...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { 
            role: 'system', 
            content: 'You are a data analyst specializing in sales conversion analysis. Your goal is to identify why potential customers did not convert and how to recover them. Return only valid JSON without markdown formatting.' 
          },
          { role: 'user', content: aiPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[Background] AI API error:', aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices?.[0]?.message?.content || '';
    
    // Log AI cost
    const inputTokens = Math.ceil(aiPrompt.length / 4);
    const outputTokens = Math.ceil(analysisText.length / 4);
    logApiCost(supabase, {
      service_provider: 'lovable_ai',
      service_type: 'ai_non_booking_insights',
      edge_function: 'analyze-non-booking-insights',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      metadata: { 
        model: 'google/gemini-2.5-pro', 
        analysis_period,
        total_calls: totalCalls 
      }
    });
    
    console.log('[Background] AI response received, parsing...');

    // Parse AI response
    let parsedAnalysis;
    try {
      // Clean markdown formatting if present
      let cleanText = analysisText;
      if (cleanText.includes('```json')) {
        cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanText.includes('```')) {
        cleanText = cleanText.replace(/```\n?/g, '');
      }
      parsedAnalysis = JSON.parse(cleanText.trim());
    } catch (parseError) {
      console.error('[Background] Failed to parse AI response:', parseError);
      console.log('[Background] Raw AI response:', analysisText.substring(0, 500));
      throw new Error('Failed to parse AI analysis response');
    }

    // Merge computed agent data with AI insights
    const finalAgentBreakdown: Record<string, any> = {};
    for (const [agentName, data] of Object.entries(computedAgentBreakdown)) {
      const aiInsight = parsedAnalysis.agent_insights?.[agentName] || {};
      finalAgentBreakdown[agentName] = {
        ...data,
        improvement_area: aiInsight.improvement_area || 'Review call recordings for coaching opportunities',
        pattern_observation: aiInsight.pattern_observation || null
      };
    }

    // Merge computed market data with AI insights
    const finalMarketBreakdown: Record<string, any> = {};
    for (const [market, data] of Object.entries(computedMarketBreakdown)) {
      const aiInsight = parsedAnalysis.market_insights?.[market] || {};
      finalMarketBreakdown[market] = {
        ...data,
        unique_pattern: aiInsight.unique_pattern || null,
        suggested_focus: aiInsight.suggested_focus || null
      };
    }

    console.log(`[Background] Final agent breakdown: ${Object.keys(finalAgentBreakdown).length} agents`);
    console.log(`[Background] Final market breakdown: ${Object.keys(finalMarketBreakdown).length} markets`);

    // Update insight record with results
    const updateResult = await supabase
      .from('non_booking_insights')
      .update({
        total_calls_analyzed: totalCalls,
        rejection_reasons: parsedAnalysis.rejection_reasons || [],
        missed_opportunities: parsedAnalysis.missed_opportunities || [],
        sentiment_distribution: sentimentDistribution,
        objection_patterns: parsedAnalysis.objection_patterns || [],
        recovery_recommendations: parsedAnalysis.recovery_recommendations || [],
        agent_breakdown: finalAgentBreakdown,
        market_breakdown: finalMarketBreakdown,
        avg_call_duration_seconds: avgCallDurationSeconds,
        raw_analysis: analysisText,
        status: 'completed'
      })
      .eq('id', insightId);

    if (updateResult.error) {
      console.error('[Background] Error updating insight:', updateResult.error);
      throw new Error(`Failed to update insight: ${updateResult.error.message}`);
    }

    console.log(`[Background] Non-Booking analysis complete for insight ${insightId}`);

  } catch (error) {
    console.error('[Background] Analysis failed:', error);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await supabase
      .from('non_booking_insights')
      .update({ 
        status: 'failed', 
        error_message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
      .eq('id', insightId);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { analysis_period, date_range_start, date_range_end } = await req.json();

    if (!analysis_period || !date_range_start || !date_range_end) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: analysis_period, date_range_start, date_range_end' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create insight record with processing status
    const { data: insight, error: insertError } = await supabase
      .from('non_booking_insights')
      .insert({
        analysis_period,
        date_range_start,
        date_range_end,
        status: 'processing'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating insight record:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create insight record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created Non-Booking insight record: ${insight.id}`);

    // Start background processing
    EdgeRuntime.waitUntil(
      processNonBookingAnalysis(
        supabaseUrl,
        supabaseServiceKey,
        lovableApiKey,
        insight.id,
        analysis_period,
        date_range_start,
        date_range_end
      )
    );

    // Return immediately with insight ID
    return new Response(
      JSON.stringify({ 
        success: true, 
        insight_id: insight.id,
        message: 'Non-Booking analysis started. Poll for status updates.' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-non-booking-insights:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
