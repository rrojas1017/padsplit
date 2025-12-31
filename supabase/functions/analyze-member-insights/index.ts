import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

interface BookingWithTranscription {
  id: string;
  member_name: string;
  market_city: string;
  market_state: string;
  booking_transcriptions: Array<{
    call_key_points: CallKeyPoints;
  }>;
}

// Cost logging helper
async function logApiCost(supabase: any, params: {
  service_provider: 'elevenlabs' | 'lovable_ai';
  service_type: string;
  edge_function: string;
  booking_id?: string;
  agent_id?: string;
  site_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  audio_duration_seconds?: number;
  character_count?: number;
  metadata?: Record<string, any>;
}) {
  try {
    let cost = 0;
    if (params.service_provider === 'elevenlabs') {
      if (params.audio_duration_seconds) {
        cost += (params.audio_duration_seconds / 60) * 0.10;
      }
      if (params.character_count) {
        cost += params.character_count * 0.0003;
      }
    } else if (params.service_provider === 'lovable_ai') {
      // Model-aware pricing for Lovable AI
      const model = params.metadata?.model || 'google/gemini-2.5-flash';
      let inputRate = 0.0001;  // Flash default: ~$0.0001 per 1K input
      let outputRate = 0.0003; // Flash default: ~$0.0003 per 1K output
      
      if (model.includes('gemini-2.5-pro')) {
        // Gemini Pro: ~$0.00125 per 1K input, ~$0.005 per 1K output
        inputRate = 0.00125;
        outputRate = 0.005;
      }
      
      const inputCost = ((params.input_tokens || 0) / 1000) * inputRate;
      const outputCost = ((params.output_tokens || 0) / 1000) * outputRate;
      cost = inputCost + outputCost;
    }

    await supabase.from('api_costs').insert({
      ...params,
      estimated_cost_usd: cost
    });
    console.log(`[Cost] Logged ${params.service_type}: $${cost.toFixed(4)}`);
  } catch (error) {
    console.error('[Cost] Failed to log cost:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { analysis_period = 'manual', date_range_start, date_range_end, created_by } = await req.json();

    console.log(`Starting ${analysis_period} member insights analysis from ${date_range_start} to ${date_range_end}`);

    // Fetch all bookings with completed transcriptions in date range
    // Join with booking_transcriptions table where call_key_points are stored
    const { data: bookingsRaw, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id, 
        member_name, 
        market_city, 
        market_state,
        booking_transcriptions (
          call_key_points
        )
      `)
      .eq('transcription_status', 'completed')
      .gte('booking_date', date_range_start)
      .lte('booking_date', date_range_end);

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
    }

    console.log(`Raw bookings fetched: ${bookingsRaw?.length || 0}`);
    if (bookingsRaw && bookingsRaw.length > 0) {
      console.log('Sample booking structure:', JSON.stringify(bookingsRaw[0], null, 2));
    }

    // Filter to only include bookings with call_key_points
    // Note: booking_transcriptions is a 1-to-1 relationship, so it returns an object (or array with single item)
    const bookings = (bookingsRaw || []).filter((b: any) => {
      // Handle both array and object responses from Supabase
      const transcription = Array.isArray(b.booking_transcriptions) 
        ? b.booking_transcriptions[0] 
        : b.booking_transcriptions;
      return transcription?.call_key_points;
    }) as BookingWithTranscription[];

    console.log(`Filtered bookings with call_key_points: ${bookings.length}`);

    if (bookings.length === 0) {
      console.log('No transcribed bookings found in date range');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No transcribed calls found in the selected date range' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log(`Found ${bookings.length} transcribed bookings to analyze`);

    // Aggregate all call data
    const allConcerns: string[] = [];
    const allPreferences: string[] = [];
    const allObjections: string[] = [];
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    const readinessCounts = { high: 0, medium: 0, low: 0 };
    const marketData: Record<string, { concerns: string[], objections: string[], preferences: string[], count: number }> = {};

    // Track member names for journey insights
    const memberCallCounts: Record<string, number> = {};

    for (const booking of bookings) {
      // Handle both array and object responses
      const transcription = Array.isArray(booking.booking_transcriptions)
        ? booking.booking_transcriptions[0]
        : booking.booking_transcriptions;
      const keyPoints = transcription?.call_key_points;
      if (!keyPoints) continue;

      if (keyPoints.memberConcerns) allConcerns.push(...keyPoints.memberConcerns);
      if (keyPoints.memberPreferences) allPreferences.push(...keyPoints.memberPreferences);
      if (keyPoints.objections) allObjections.push(...keyPoints.objections);

      if (keyPoints.callSentiment) {
        sentimentCounts[keyPoints.callSentiment]++;
      }

      if (keyPoints.moveInReadiness) {
        readinessCounts[keyPoints.moveInReadiness]++;
      }

      const marketKey = `${booking.market_city || 'Unknown'}, ${booking.market_state || 'Unknown'}`;
      if (!marketData[marketKey]) {
        marketData[marketKey] = { concerns: [], objections: [], preferences: [], count: 0 };
      }
      marketData[marketKey].count++;
      if (keyPoints.memberConcerns) marketData[marketKey].concerns.push(...keyPoints.memberConcerns);
      if (keyPoints.objections) marketData[marketKey].objections.push(...keyPoints.objections);
      if (keyPoints.memberPreferences) marketData[marketKey].preferences.push(...keyPoints.memberPreferences);

      const memberName = booking.member_name?.toLowerCase().trim();
      if (memberName) {
        memberCallCounts[memberName] = (memberCallCounts[memberName] || 0) + 1;
      }
    }

    // Calculate sentiment percentages
    const totalCalls = bookings.length;
    const sentimentDistribution = {
      positive: Math.round((sentimentCounts.positive / totalCalls) * 100),
      neutral: Math.round((sentimentCounts.neutral / totalCalls) * 100),
      negative: Math.round((sentimentCounts.negative / totalCalls) * 100)
    };

    // Build AI prompt for analysis
    const aiPrompt = `You are analyzing PadSplit member call data. PadSplit provides affordable room rentals for working-class individuals, typically single occupants with weekly budgets of $150-250.

CONTEXT:
- Members often rely on public transportation
- Weekly payments align with hourly/biweekly paychecks
- Members compare multiple listings before booking
- Move-in timing often depends on paychecks and deposits
- Properties are shared living spaces with private rooms

ANALYSIS DATA FROM ${totalCalls} CALLS (${date_range_start} to ${date_range_end}):

MEMBER CONCERNS (${allConcerns.length} total):
${allConcerns.slice(0, 100).join('\n')}

MEMBER PREFERENCES (${allPreferences.length} total):
${allPreferences.slice(0, 100).join('\n')}

OBJECTIONS (${allObjections.length} total):
${allObjections.slice(0, 100).join('\n')}

SENTIMENT BREAKDOWN:
- Positive: ${sentimentCounts.positive} calls (${sentimentDistribution.positive}%)
- Neutral: ${sentimentCounts.neutral} calls (${sentimentDistribution.neutral}%)
- Negative: ${sentimentCounts.negative} calls (${sentimentDistribution.negative}%)

MOVE-IN READINESS:
- High: ${readinessCounts.high} calls
- Medium: ${readinessCounts.medium} calls
- Low: ${readinessCounts.low} calls

MARKET DATA:
${Object.entries(marketData).map(([market, data]) => 
  `${market}: ${data.count} calls`
).join('\n')}

Analyze this data and return a JSON object with EXACTLY this structure:
{
  "pain_points": [
    {"category": "Transportation", "description": "specific pain point", "frequency": 25, "examples": ["example1", "example2"]},
    {"category": "Payment", "description": "specific pain point", "frequency": 20, "examples": ["example1"]}
  ],
  "payment_insights": [
    {"insight": "specific insight about payment patterns", "frequency": 15, "impact": "high|medium|low"}
  ],
  "transportation_insights": [
    {"insight": "specific insight about transportation needs", "frequency": 12, "markets_affected": ["Atlanta", "Dallas"]}
  ],
  "price_sensitivity": [
    {"pattern": "budget range or comparison behavior", "frequency": 18, "suggested_action": "what PadSplit could do"}
  ],
  "move_in_barriers": [
    {"barrier": "what prevents/delays move-in", "frequency": 10, "impact_score": 8, "resolution": "how to address"}
  ],
  "property_preferences": [
    {"preference": "amenity or feature preference", "frequency": 22, "priority": "must-have|nice-to-have"}
  ],
  "objection_patterns": [
    {"objection": "common hesitation", "frequency": 15, "suggested_response": "how agents should handle"}
  ],
  "market_breakdown": {
    "Atlanta, GA": {"top_concern": "transportation", "unique_pattern": "description", "call_count": 10},
    "Dallas, TX": {"top_concern": "pricing", "unique_pattern": "description", "call_count": 8}
  },
  "ai_recommendations": [
    {"recommendation": "specific actionable item", "category": "Marketing|Retention|Operations|Training", "priority": "high|medium|low", "expected_impact": "description of potential impact"}
  ],
  "member_journey_insights": [
    {"pattern": "repeat caller behavior or journey insight", "frequency": 5, "implication": "what this means for PadSplit"}
  ]
}

IMPORTANT:
- Frequencies should be percentages of total calls analyzed
- Include at least 3-5 items in each category if data supports it
- Focus on actionable insights for marketing and retention
- Identify patterns appearing in >10% of calls as significant
- Market breakdown should only include markets with 3+ calls
- Recommendations should be specific and measurable`;

    console.log('Sending data to AI for analysis...');

    // Call Lovable AI Gateway
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: 'You are a data analyst specializing in customer insights for affordable housing. Return only valid JSON without markdown formatting.' },
          { role: 'user', content: aiPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices?.[0]?.message?.content || '';
    
    // Log AI cost
    const inputTokens = Math.ceil(aiPrompt.length / 4);
    const outputTokens = Math.ceil(analysisText.length / 4);
    logApiCost(supabase, {
      service_provider: 'lovable_ai',
      service_type: 'ai_member_insights',
      edge_function: 'analyze-member-insights',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      metadata: { 
        model: 'google/gemini-2.5-pro', 
        analysis_period,
        total_calls: totalCalls 
      }
    });
    
    console.log('AI response received, parsing...');

    // Parse AI response
    let parsedAnalysis;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw response:', analysisText);
      parsedAnalysis = {
        pain_points: [],
        payment_insights: [],
        transportation_insights: [],
        price_sensitivity: [],
        move_in_barriers: [],
        property_preferences: [],
        objection_patterns: [],
        market_breakdown: {},
        ai_recommendations: [],
        member_journey_insights: []
      };
    }

    // Calculate repeat callers for journey insights
    const repeatCallers = Object.entries(memberCallCounts)
      .filter(([_, count]) => count > 1)
      .length;

    if (repeatCallers > 0 && (!parsedAnalysis.member_journey_insights || parsedAnalysis.member_journey_insights.length === 0)) {
      parsedAnalysis.member_journey_insights = [{
        pattern: `${repeatCallers} members called multiple times before booking`,
        frequency: Math.round((repeatCallers / Object.keys(memberCallCounts).length) * 100),
        implication: 'Some members need multiple touchpoints before making a decision'
      }];
    }

    // Insert analysis results into database
    const { data: insertedInsight, error: insertError } = await supabase
      .from('member_insights')
      .insert({
        analysis_period,
        date_range_start,
        date_range_end,
        total_calls_analyzed: totalCalls,
        pain_points: parsedAnalysis.pain_points || [],
        payment_insights: parsedAnalysis.payment_insights || [],
        transportation_insights: parsedAnalysis.transportation_insights || [],
        price_sensitivity: parsedAnalysis.price_sensitivity || [],
        move_in_barriers: parsedAnalysis.move_in_barriers || [],
        property_preferences: parsedAnalysis.property_preferences || [],
        objection_patterns: parsedAnalysis.objection_patterns || [],
        market_breakdown: parsedAnalysis.market_breakdown || {},
        sentiment_distribution: sentimentDistribution,
        ai_recommendations: parsedAnalysis.ai_recommendations || [],
        member_journey_insights: parsedAnalysis.member_journey_insights || [],
        raw_analysis: analysisText,
        created_by
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting insights:', insertError);
      throw new Error(`Failed to save insights: ${insertError.message}`);
    }

    console.log(`Member insights analysis completed successfully. ID: ${insertedInsight.id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      insight_id: insertedInsight.id,
      total_calls_analyzed: totalCalls,
      message: `Successfully analyzed ${totalCalls} calls`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-member-insights:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
