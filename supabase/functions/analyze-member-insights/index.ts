import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  booking_date: string;
  call_duration_seconds: number | null;
  booking_transcriptions: Array<{
    call_key_points: CallKeyPoints;
  }>;
}

interface SourceBookingInfo {
  booking_id: string;
  quote: string;
  market: string;
  date: string;
}

interface PainPointWithSources {
  category: string;
  description: string;
  frequency: number;
  examples: string[];
  source_bookings: SourceBookingInfo[];
  trend_delta?: number;
  is_emerging?: boolean;
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
      const model = params.metadata?.model || 'google/gemini-2.5-flash';
      let inputRate = 0.0001;
      let outputRate = 0.0003;
      
      if (model.includes('gemini-2.5-pro')) {
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

// Fetch previous analysis for trend comparison
async function fetchPreviousAnalysis(supabase: any, analysisPeriod: string, currentDateEnd: string) {
  try {
    const { data, error } = await supabase
      .from('member_insights')
      .select('id, pain_points, objection_patterns, date_range_start, date_range_end, total_calls_analyzed')
      .eq('analysis_period', analysisPeriod)
      .eq('status', 'completed')
      .lt('date_range_end', currentDateEnd)
      .order('date_range_end', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Previous] Error fetching previous analysis:', error);
      return null;
    }

    console.log(`[Previous] Found previous analysis: ${data?.id || 'none'}`);
    return data;
  } catch (error) {
    console.error('[Previous] Exception fetching previous analysis:', error);
    return null;
  }
}

// Calculate trend deltas between current and previous pain points
function calculateTrendDeltas(
  currentPainPoints: PainPointWithSources[],
  previousPainPoints: any[]
): { painPointsWithTrends: PainPointWithSources[], emergingIssues: string[] } {
  const previousMap = new Map<string, number>();
  const previousCategories = new Set<string>();
  
  for (const pp of previousPainPoints || []) {
    const key = pp.category?.toLowerCase()?.trim();
    if (key) {
      previousMap.set(key, pp.frequency || 0);
      previousCategories.add(key);
    }
  }

  const emergingIssues: string[] = [];
  const painPointsWithTrends = currentPainPoints.map(pp => {
    const key = pp.category?.toLowerCase()?.trim();
    const previousFreq = previousMap.get(key);
    
    if (previousFreq === undefined) {
      // This is a new/emerging issue
      emergingIssues.push(pp.category);
      return {
        ...pp,
        trend_delta: pp.frequency, // All new
        is_emerging: true
      };
    } else {
      return {
        ...pp,
        trend_delta: pp.frequency - previousFreq,
        is_emerging: false
      };
    }
  });

  return { painPointsWithTrends, emergingIssues };
}

// Constants for batch pagination
const BATCH_SIZE = 500;
const FUNCTION_TIMEOUT_MS = 120000; // 2 minutes safety margin from 150s limit
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

// Sleep helper for retry delays
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch bookings in batches to bypass Supabase 1,000 row limit
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

  console.log(`[Pagination] Starting batch fetch for Booking records from ${start} to ${end}`);

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
          .select(`
            id, 
            member_name, 
            market_city, 
            market_state,
            booking_date,
            call_duration_seconds,
            booking_transcriptions (
              call_key_points
            )
          `)
          .eq('transcription_status', 'completed')
          .neq('status', 'Non Booking')
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

// Background processing function
async function processAnalysis(
  supabaseUrl: string,
  supabaseServiceKey: string,
  lovableApiKey: string,
  insightId: string,
  analysis_period: string,
  date_range_start: string,
  date_range_end: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const startTime = Date.now();
  
  try {
    console.log(`[Background] Starting analysis for insight ${insightId}`);
    
    // Fetch previous analysis for trend comparison
    const previousAnalysis = await fetchPreviousAnalysis(supabase, analysis_period, date_range_end);
    
    // Phase 1: Fetch all bookings with pagination to bypass 1,000 row limit
    console.log(`[Background] Phase 1: Fetching bookings with batch pagination...`);
    const bookingsRaw = await fetchBookingsInBatches(supabase, date_range_start, date_range_end, startTime);

    console.log(`[Background] Raw bookings fetched: ${bookingsRaw?.length || 0}`);

    // Filter to only include bookings with call_key_points
    const bookings = (bookingsRaw || []).filter((b: any) => {
      const transcription = Array.isArray(b.booking_transcriptions) 
        ? b.booking_transcriptions[0] 
        : b.booking_transcriptions;
      return transcription?.call_key_points;
    }) as BookingWithTranscription[];

    console.log(`[Background] Phase 1 complete: ${bookings.length} of ${bookingsRaw.length} records have call_key_points for analysis`);

    if (bookings.length === 0) {
      console.log('[Background] No transcribed bookings found in date range');
      await supabase
        .from('member_insights')
        .update({ 
          status: 'failed', 
          error_message: 'No transcribed calls found in the selected date range' 
        })
        .eq('id', insightId);
      return;
    }

    // Aggregate all call data - NOW WITH BOOKING IDS
    const allConcerns: Array<{ text: string; booking_id: string; market: string; date: string }> = [];
    const allPreferences: Array<{ text: string; booking_id: string; market: string; date: string }> = [];
    const allObjections: Array<{ text: string; booking_id: string; market: string; date: string }> = [];
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    const readinessCounts = { high: 0, medium: 0, low: 0 };
    const marketData: Record<string, { concerns: string[], objections: string[], preferences: string[], count: number }> = {};
    let totalDuration = 0;
    let durationCount = 0;
    const memberCallCounts: Record<string, number> = {};

    for (const booking of bookings) {
      const transcription = Array.isArray(booking.booking_transcriptions)
        ? booking.booking_transcriptions[0]
        : booking.booking_transcriptions;
      const keyPoints = transcription?.call_key_points;
      if (!keyPoints) continue;

      const market = `${booking.market_city || 'Unknown'}, ${booking.market_state || 'Unknown'}`;
      const bookingDate = booking.booking_date;

      // Track concerns with source booking info
      if (keyPoints.memberConcerns) {
        for (const concern of keyPoints.memberConcerns) {
          allConcerns.push({
            text: concern,
            booking_id: booking.id,
            market,
            date: bookingDate
          });
        }
      }

      if (keyPoints.memberPreferences) {
        for (const pref of keyPoints.memberPreferences) {
          allPreferences.push({
            text: pref,
            booking_id: booking.id,
            market,
            date: bookingDate
          });
        }
      }

      if (keyPoints.objections) {
        for (const obj of keyPoints.objections) {
          allObjections.push({
            text: obj,
            booking_id: booking.id,
            market,
            date: bookingDate
          });
        }
      }

      if (keyPoints.callSentiment) {
        sentimentCounts[keyPoints.callSentiment]++;
      }

      if (keyPoints.moveInReadiness) {
        readinessCounts[keyPoints.moveInReadiness]++;
      }

      // Track call duration for average calculation
      if (booking.call_duration_seconds && booking.call_duration_seconds > 0) {
        totalDuration += booking.call_duration_seconds;
        durationCount++;
      }

      const marketKey = market;
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

    // Calculate average call duration
    const avgCallDurationSeconds = durationCount > 0 ? totalDuration / durationCount : 0;

    const totalCalls = bookings.length;
    const sentimentDistribution = {
      positive: Math.round((sentimentCounts.positive / totalCalls) * 100),
      neutral: Math.round((sentimentCounts.neutral / totalCalls) * 100),
      negative: Math.round((sentimentCounts.negative / totalCalls) * 100)
    };

    // Build AI prompt for analysis - ENHANCED with source tracking instructions and customer journeys
    // Add note for smaller datasets
    const smallDatasetNote = totalCalls < 30 
      ? `\n\nNOTE: This is a smaller dataset (${totalCalls} calls). Still provide analysis with the data available - do not skip categories. If there isn't enough data for a category, include it with an empty array. ALWAYS return valid JSON.`
      : '';

    const aiPrompt = `You are analyzing PadSplit member call data. PadSplit provides affordable room rentals for working-class individuals, typically single occupants with weekly budgets of $150-250.

CONTEXT:
- Members often rely on public transportation
- Weekly payments align with hourly/biweekly paychecks
- Members compare multiple listings before booking
- Move-in timing often depends on paychecks and deposits
- Properties are shared living spaces with private rooms

ANALYSIS DATA FROM ${totalCalls} CALLS (${date_range_start} to ${date_range_end}):

MEMBER CONCERNS (${allConcerns.length} total) - each entry includes the actual quote:
${allConcerns.slice(0, 150).map(c => `"${c.text}" - ${c.market}, ${c.date}`).join('\n')}

MEMBER PREFERENCES (${allPreferences.length} total):
${allPreferences.slice(0, 100).map(p => `"${p.text}" - ${p.market}`).join('\n')}

OBJECTIONS (${allObjections.length} total):
${allObjections.slice(0, 100).map(o => `"${o.text}" - ${o.market}`).join('\n')}

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
  `${market}: ${data.count} calls, Top concerns: ${data.concerns.slice(0, 3).join('; ')}`
).join('\n')}

${previousAnalysis ? `
PREVIOUS ANALYSIS (${previousAnalysis.date_range_start} to ${previousAnalysis.date_range_end}):
Previous pain point categories: ${(previousAnalysis.pain_points || []).map((p: any) => `${p.category} (${p.frequency}%)`).join(', ')}
` : ''}

Analyze this data and return a JSON object with EXACTLY this structure. 

CRITICAL: You MUST include the "customer_journeys" array - this is the MOST IMPORTANT output. Generate 3-6 distinct customer personas.

{
  "customer_journeys": [
    {
      "persona_name": "The Urgent Relocator",
      "frequency_percent": 28,
      "trigger_quote": "I need to move by Friday",
      "journey_stages": [
        {"stage": "Crisis Trigger", "emotion": "stressed", "action": "emergency search"},
        {"stage": "Quick Search", "emotion": "anxious", "friction": "too many options"},
        {"stage": "Payment Confusion", "emotion": "frustrated", "friction": "unclear total fees"},
        {"stage": "Decision Point", "emotion": "hesitant", "outcome": "booking or drop"}
      ],
      "intervention_points": [
        "Show 'Move-in ASAP' filter prominently",
        "Display total cost upfront on listing cards"
      ],
      "example_quotes": ["I'm getting evicted...", "My landlord gave me 5 days..."],
      "related_pain_points": ["Payment & Fee Confusion", "Booking Process Speed"],
      "market_concentration": {"Atlanta, GA": 35, "Dallas, TX": 25}
    }
  ],
  "pain_points": [
    {
      "category": "Transportation", 
      "description": "specific pain point description", 
      "frequency": 25, 
      "examples": ["actual quote from a call", "another actual quote"],
      "market_breakdown": {"Atlanta, GA": 35, "Dallas, TX": 15},
      "sub_categories": [
        {
          "name": "Bus Route Access",
          "frequency": 40,
          "description": "Members need properties near specific bus routes for their commute",
          "examples": ["Is it near the 39 bus line?"],
          "solution": {
            "action": "Add public transit proximity info to every listing",
            "owner": "Product",
            "effort": "medium",
            "expected_outcome": "Reduce transportation-related objections by ~25%"
          }
        }
      ],
      "actionable_solutions": [
        {
          "action": "Create a transit guide PDF for each market that agents can share",
          "owner": "Training",
          "effort": "low",
          "expected_outcome": "Agents can proactively address transportation concerns"
        }
      ]
    }
  ],
  "payment_insights": [
    {"insight": "specific insight about payment patterns", "frequency": 15, "impact": "high|medium|low", "examples": ["quote"]}
  ],
  "transportation_insights": [
    {"insight": "specific insight about transportation needs", "frequency": 12, "markets_affected": ["Atlanta", "Dallas"], "examples": ["quote"]}
  ],
  "price_sensitivity": [
    {"pattern": "budget range or comparison behavior", "frequency": 18, "suggested_action": "what PadSplit could do"}
  ],
  "move_in_barriers": [
    {"barrier": "what prevents/delays move-in", "frequency": 10, "impact_score": 8, "resolution": "how to address", "examples": ["quote"]}
  ],
  "property_preferences": [
    {"preference": "amenity or feature preference", "frequency": 22, "priority": "must-have|nice-to-have"}
  ],
  "objection_patterns": [
    {"objection": "common hesitation", "frequency": 15, "suggested_response": "how agents should handle", "examples": ["quote"]}
  ],
  "market_breakdown": {
    "Atlanta, GA": {"top_concern": "transportation", "unique_pattern": "description", "call_count": 10}
  },
  "ai_recommendations": [
    {"recommendation": "specific actionable item", "category": "Marketing|Retention|Operations|Training", "priority": "high|medium|low", "expected_impact": "description"}
  ],
  "member_journey_insights": [
    {"pattern": "repeat caller behavior or journey insight", "frequency": 5, "implication": "what this means for PadSplit"}
  ]
}

CUSTOMER JOURNEY REQUIREMENTS (MANDATORY - DO NOT SKIP):
- Generate 3-6 distinct customer journey personas based on patterns you observe
- Each persona should represent a real behavioral pattern (e.g., urgent relocators, budget-conscious shoppers, skeptical first-timers, transit-dependent members, denied-and-retrying)
- Journey stages should flow logically from trigger to outcome (3-5 stages each)
- Include actual quotes from the call data as examples
- Market concentration shows which markets have higher percentages of this persona

PAIN POINT SUB-CATEGORY REQUIREMENTS (MANDATORY):
- For any pain point with frequency >= 20%, you MUST break it into 2-5 specific sub_categories
- Each sub_category frequency is a percentage OF THE PARENT CATEGORY'S calls (should sum to approximately 100%)
- Each sub_category MUST include a practical "solution" object with: action (concrete step), owner (Product|Training|Marketing|Operations), effort (low|medium|high), and expected_outcome
- The top-level "actionable_solutions" array should contain 1-3 cross-cutting solutions for the overall pain point
- Pain points below 20% frequency do NOT need sub_categories (omit the field or use empty array)

ADDITIONAL REQUIREMENTS:
- Frequencies should be percentages of total calls analyzed
- Include at least 3-5 items in each category if data supports it
- ALWAYS include real verbatim quotes in the "examples" arrays
- Market breakdown should only include markets with 3+ calls
${smallDatasetNote}

CRITICAL: Your response must start with { and end with }. Return ONLY the JSON object, no explanations or markdown.`;

    console.log('[Background] Sending data to AI for analysis...');

    // Retry loop for AI calls
    let parsedAnalysis;
    let retryCount = 0;
    const maxRetries = 2;
    let analysisText = '';
    let inputTokens = 0;
    let outputTokens = 0;

    while (retryCount <= maxRetries) {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
          messages: [
            { role: 'system', content: 'You are a data analyst specializing in customer insights for affordable housing. Return only valid JSON without markdown formatting. Your response must be a single JSON object starting with { and ending with }.' },
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
      analysisText = aiData.choices?.[0]?.message?.content || '';
      
      // Calculate tokens for cost logging
      inputTokens = Math.ceil(aiPrompt.length / 4);
      outputTokens = Math.ceil(analysisText.length / 4);

      try {
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedAnalysis = JSON.parse(jsonMatch[0]);
          console.log(`[Background] JSON parsed successfully on attempt ${retryCount + 1}`);
          break; // Success - exit retry loop
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        retryCount++;
        console.error(`[Background] JSON parse failed (attempt ${retryCount}/${maxRetries + 1}):`, parseError);
        
        if (retryCount > maxRetries) {
          // All retries exhausted - mark as failed
          throw new Error('AI returned invalid response after multiple attempts. Please try again.');
        }
        
        // Wait before retry
        console.log(`[Background] Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Log AI cost
    logApiCost(supabase, {
      service_provider: 'lovable_ai',
      service_type: 'ai_member_insights',
      edge_function: 'analyze-member-insights',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      metadata: { 
        model: 'google/gemini-2.5-pro', 
        analysis_period,
        total_calls: totalCalls,
        retry_count: retryCount
      }
    });
    
    console.log('[Background] AI response received and parsed successfully');

    // Build source booking IDs mapping for pain points
    const sourceBookingIds: Record<string, string[]> = {};
    
    // Map examples in pain points back to booking IDs
    for (const painPoint of parsedAnalysis.pain_points || []) {
      const category = painPoint.category?.toLowerCase()?.trim() || '';
      const matchingBookingIds: string[] = [];
      
      // Find bookings that match the examples
      for (const example of painPoint.examples || []) {
        const exampleLower = example.toLowerCase();
        for (const concern of allConcerns) {
          if (concern.text.toLowerCase().includes(exampleLower.slice(0, 30)) || 
              exampleLower.includes(concern.text.toLowerCase().slice(0, 30))) {
            if (!matchingBookingIds.includes(concern.booking_id)) {
              matchingBookingIds.push(concern.booking_id);
            }
          }
        }
      }
      
      // Also find bookings by category keywords
      const categoryKeywords = category.split(/[\s&]+/).filter((k: string) => k.length > 3);
      for (const concern of allConcerns) {
        const concernLower = concern.text.toLowerCase();
        if (categoryKeywords.some((kw: string) => concernLower.includes(kw))) {
          if (!matchingBookingIds.includes(concern.booking_id)) {
            matchingBookingIds.push(concern.booking_id);
          }
        }
      }
      
      if (matchingBookingIds.length > 0) {
        sourceBookingIds[category] = matchingBookingIds.slice(0, 20); // Limit to 20 per category
      }
    }

    // Calculate trend deltas if we have previous analysis
    let painPointsWithTrends = parsedAnalysis.pain_points || [];
    let emergingIssues: string[] = [];
    let trendComparison = null;

    if (previousAnalysis?.pain_points) {
      const trendResult = calculateTrendDeltas(
        parsedAnalysis.pain_points || [],
        previousAnalysis.pain_points
      );
      painPointsWithTrends = trendResult.painPointsWithTrends;
      emergingIssues = trendResult.emergingIssues;
      
      trendComparison = {
        previous_insight_id: previousAnalysis.id,
        previous_date_range: `${previousAnalysis.date_range_start} to ${previousAnalysis.date_range_end}`,
        previous_total_calls: previousAnalysis.total_calls_analyzed,
        current_total_calls: totalCalls
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

    // Validate that we got meaningful insights before marking as completed
    const hasAnyInsights = 
      (parsedAnalysis.pain_points?.length > 0) ||
      (parsedAnalysis.objection_patterns?.length > 0) ||
      (parsedAnalysis.ai_recommendations?.length > 0) ||
      (parsedAnalysis.customer_journeys?.length > 0);

    if (!hasAnyInsights && totalCalls > 0) {
      console.error(`[Background] AI returned no insights despite ${totalCalls} calls with data`);
      throw new Error(`Analysis returned no insights from ${totalCalls} available calls. Please try again.`);
    }

    // Update the insight record with results
    const { error: updateError } = await supabase
      .from('member_insights')
      .update({
        total_calls_analyzed: totalCalls,
        pain_points: painPointsWithTrends,
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
        customer_journeys: parsedAnalysis.customer_journeys || [],
        raw_analysis: analysisText,
        avg_call_duration_seconds: avgCallDurationSeconds,
        previous_insight_id: previousAnalysis?.id || null,
        source_booking_ids: sourceBookingIds,
        emerging_issues: emergingIssues,
        trend_comparison: trendComparison,
        status: 'completed'
      })
      .eq('id', insightId);

    if (updateError) {
      console.error('[Background] Error updating insights:', updateError);
      throw new Error(`Failed to save insights: ${updateError.message}`);
    }

    console.log(`[Background] Analysis completed successfully. ID: ${insightId}, Calls: ${totalCalls}, Emerging: ${emergingIssues.length}`);

  } catch (error) {
    console.error('[Background] Error in analysis:', error);
    
    // Update status to failed
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await supabase
      .from('member_insights')
      .update({ 
        status: 'failed', 
        error_message: error instanceof Error ? error.message : 'Unknown error' 
      })
      .eq('id', insightId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { analysis_period = 'manual', date_range_start, date_range_end, created_by } = await req.json();

    console.log(`Starting ${analysis_period} member insights analysis from ${date_range_start} to ${date_range_end}`);

    // Create a pending insight record immediately
    const { data: pendingInsight, error: insertError } = await supabase
      .from('member_insights')
      .insert({
        analysis_period,
        date_range_start,
        date_range_end,
        status: 'processing',
        total_calls_analyzed: 0,
        created_by
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating pending insight:', insertError);
      throw new Error(`Failed to create insight record: ${insertError.message}`);
    }

    console.log(`Created pending insight record: ${pendingInsight.id}`);

    // Start background processing using EdgeRuntime.waitUntil
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    EdgeRuntime.waitUntil(
      processAnalysis(
        supabaseUrl,
        supabaseServiceKey,
        lovableApiKey,
        pendingInsight.id,
        analysis_period,
        date_range_start,
        date_range_end
      )
    );

    // Return immediately with processing status
    return new Response(JSON.stringify({ 
      success: true, 
      insight_id: pendingInsight.id,
      status: 'processing',
      message: 'Analysis started. You can navigate away - check back for results.'
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
