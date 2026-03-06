import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cost logging
async function logApiCost(supabase: any, params: {
  service_provider: string;
  service_type: string;
  edge_function: string;
  input_tokens?: number;
  output_tokens?: number;
  metadata?: Record<string, any>;
  triggered_by_user_id?: string;
  is_internal?: boolean;
}) {
  try {
    let cost = 0;
    if (params.service_provider === 'lovable_ai') {
      const model = params.metadata?.model || 'google/gemini-2.5-pro';
      let inputRate = 0.00000125;
      let outputRate = 0.00001;
      if (model.includes('flash')) {
        inputRate = 0.0000003;
        outputRate = 0.0000025;
      }
      cost = ((params.input_tokens || 0) * inputRate) + ((params.output_tokens || 0) * outputRate);
    }
    await supabase.from('api_costs').insert({
      ...params,
      estimated_cost_usd: cost,
      triggered_by_user_id: params.triggered_by_user_id || null,
      is_internal: params.is_internal || false,
    });
    console.log(`[Cost] Logged ${params.service_type}: $${cost.toFixed(6)}`);
  } catch (error) {
    console.error('[Cost] Failed to log cost:', error);
  }
}

const DEFAULT_AGGREGATION_PROMPT = `You are a strategic analyst for PadSplit's Member Experience and Operations leadership. You are reviewing a batch of classified move-out cases to identify systemic patterns, operational blind spots, and prioritized actionable recommendations.

You will receive an array of classification JSONs — each represents one processed move-out record. Your job is to look ACROSS all records to find patterns, clusters, and systemic failures.

Respond with ONLY the JSON object below. No preamble, no markdown, no explanation.

{
  "executive_summary": {
    "total_cases": 0,
    "date_range": "range or 'not specified'",
    "addressable_pct": 0.0,
    "non_addressable_pct": 0.0,
    "partially_addressable_pct": 0.0,
    "avg_preventability_score": 0.0,
    "high_regret_count": 0,
    "high_regret_pct": 0.0,
    "payment_related_pct": 0.0,
    "host_related_pct": 0.0,
    "roommate_related_pct": 0.0,
    "life_event_pct": 0.0,
    "headline": "Single sentence capturing the most important finding."
  },
  "reason_code_distribution": {
    "distribution": [
      {
        "reason_group": "Clear descriptive group label",
        "count": 0,
        "percentage": 0.0,
        "details": "Why these records are grouped together",
        "reason_codes_included": ["Exact reason code 1", "Exact reason code 2"],
        "booking_ids": ["uuid1", "uuid2"]
      }
    ],
    "methodology": "How groups were determined and why"
  },
  "issue_clusters": [
    {
      "cluster_name": "Clear theme name",
      "cluster_description": "2-3 sentences",
      "frequency": 0,
      "pct_of_total": 0.0,
      "reason_codes_included": [],
      "booking_ids": ["uuid1", "uuid2"],
      "severity_distribution": { "critical": 0, "high": 0, "medium": 0, "low": 0 },
      "representative_quotes": [],
      "common_early_warnings": [],
      "systemic_root_cause": "Underlying system/process gap",
      "recommended_action": {
        "action": "Specific implementable recommendation",
        "owner": "Department",
        "priority": "P0 | P1 | P2",
        "expected_impact": "Estimated outcome",
        "effort": "low | medium | high",
        "quick_win": "Immediate small action or null"
      }
    }
  ],
  "emerging_patterns": [
    { "pattern": "Description", "evidence": "Which cases", "frequency": 0, "watch_or_act": "monitor | investigate | act_now" }
  ],
  "operational_blind_spots": [
    {
      "blind_spot": "Something undetected",
      "how_discovered": "Which statements",
      "estimated_prevalence": "How widespread",
      "recommended_detection_method": "Specific method",
      "priority": "P0 | P1 | P2"
    }
  ],
  "host_accountability_flags": [
    {
      "issue_pattern": "Pattern description",
      "frequency": 0,
      "impact_on_retention": "high | medium | low",
      "impact_on_legal_risk": "high | medium | low | none",
      "recommended_enforcement": "Action",
      "systemic_fix": "Process change"
    }
  ],
  "payment_friction_analysis": {
    "payment_related_moveouts": 0,
    "payment_related_pct": 0.0,
    "saveable_with_extension": 0,
    "saveable_pct": 0.0,
    "extension_awareness_gap": false,
    "extension_process_failures": [],
    "miscommunication_incidents": 0,
    "third_party_payment_signals": 0,
    "recommendation": "2-3 sentences"
  },
  "transfer_friction_analysis": {
    "considered_transfer": 0,
    "considered_transfer_pct": 0.0,
    "unaware_of_option": 0,
    "unaware_pct": 0.0,
    "blocked_by_balance": 0,
    "blocked_by_availability": 0,
    "transfer_would_have_retained": 0,
    "recommendation": "2-3 sentences"
  },
  "agent_performance_summary": {
    "total_calls_reviewed": 0,
    "avg_questions_covered": 0,
    "coverage_pct": 0.0,
    "commonly_skipped_sections": [],
    "positive_patterns": [],
    "coaching_opportunities": []
  },
  "top_actions": [
    {
      "rank": 1,
      "action": "Most impactful action",
      "rationale": "Why ranked here",
      "cases_affected": 0,
      "pct_of_batch": 0.0,
      "priority": "P0 | P1 | P2",
      "owner": "Department",
      "effort": "low | medium | high",
      "quick_win": "Immediate action or null"
    }
  ]
}

AGGREGATION RULES:
1. SEMANTIC CLUSTERING — group by actionable root cause, not surface keywords.
2. QUOTES — select for leadership urgency and emotional impact.
3. ROOT CAUSES — go deeper. Ask "why does this keep happening?"
4. PRIORITIZATION: P0 = safety/legal/>40%. P1 = high-regret/20-40%. P2 = moderate.
5. BLIND SPOTS — the most valuable insight is what nobody is tracking.
6. HONESTY — if data shows a serious systemic problem, say so directly.
7. QUICK WINS — for every major recommendation, identify a small fast action.
8. BOOKING IDS — each record has a booking_id field. In reason_code_distribution AND issue_clusters, you MUST include the exact booking_ids array for each group/cluster so we can trace back to source records. Also list the exact reason_codes_included (the individual primary_reason_code values) that were grouped together.

FIELD NAME REQUIREMENTS (DO NOT use alternative names):
- Use "booking_ids" NOT "case_ids"
- Use "representative_quotes" NOT "key_quotes", "supporting_quotes", or "impact_quote"  
- Use "cluster_description" NOT "description"
- Use "frequency" NOT "case_count" or "count"
- Use "systemic_root_cause" NOT "root_cause"
- Use "recommended_action" as an OBJECT {action, owner, priority, expected_impact, effort, quick_win} NOT a string
- Use "reason_codes_included" NOT "reason_codes"
- Use "pct_of_total" NOT "percentage"`;

// Normalize issue clusters to match expected UI schema
function normalizeInsightData(data: any, totalRecords: number): any {
  if (!data) return data;

  // Normalize issue_clusters
  if (Array.isArray(data.issue_clusters)) {
    data.issue_clusters = data.issue_clusters.map((cluster: any) => {
      // Fix field name mismatches — handle ALL observed AI variations
      const freq = cluster.frequency || cluster.case_count || cluster.count || cluster.cases_affected || 0;
      const bookingIds = cluster.booking_ids || cluster.case_ids || [];
      const quotes = cluster.representative_quotes || cluster.supporting_quotes || cluster.key_quotes || cluster.quotes || [];
      // Wrap single-string impact_quote into array
      const finalQuotes = quotes.length > 0 ? quotes :
        (cluster.impact_quote ? [cluster.impact_quote] : 
         (Array.isArray(cluster.key_issues) ? cluster.key_issues : []));

      const normalized: any = {
        cluster_name: (cluster.cluster_name || cluster.name || 'Unknown')
          .replace(/^P[0-3]:\s*/i, ''), // Strip priority prefixes
        cluster_description: cluster.cluster_description || cluster.description || cluster.summary || '',
        frequency: freq,
        pct_of_total: cluster.pct_of_total || cluster.percentage ||
          (totalRecords > 0 ? Math.round((freq / totalRecords) * 1000) / 10 : 0),
        booking_ids: bookingIds,
        reason_codes_included: cluster.reason_codes_included || cluster.reason_codes || [],
        severity_distribution: cluster.severity_distribution || { critical: 0, high: 0, medium: 0, low: 0 },
        representative_quotes: finalQuotes,
        common_early_warnings: cluster.common_early_warnings || [],
        systemic_root_cause: cluster.systemic_root_cause || cluster.root_cause || '',
      };

      // Ensure recommended_action is an object
      const ra = cluster.recommended_action;
      if (typeof ra === 'string') {
        normalized.recommended_action = {
          action: ra,
          owner: cluster.owner || 'Operations',
          priority: cluster.priority || 'P2',
          expected_impact: cluster.expected_impact || '',
          effort: cluster.effort || 'medium',
          quick_win: cluster.quick_win || null,
        };
      } else if (ra && typeof ra === 'object') {
        normalized.recommended_action = {
          action: ra.action || ra.recommendation || '',
          owner: ra.owner || 'Operations',
          priority: ra.priority || cluster.priority || 'P2',
          expected_impact: ra.expected_impact || '',
          effort: ra.effort || 'medium',
          quick_win: ra.quick_win || null,
        };
      } else {
        normalized.recommended_action = {
          action: '',
          owner: 'Operations',
          priority: cluster.priority || 'P2',
          expected_impact: '',
          effort: 'medium',
          quick_win: null,
        };
      }

      return normalized;
    });
  }

  // Normalize reason_code_distribution entries
  if (data.reason_code_distribution?.distribution && Array.isArray(data.reason_code_distribution.distribution)) {
    data.reason_code_distribution.distribution = data.reason_code_distribution.distribution.map((item: any) => ({
      reason_group: item.reason_group || item.group || 'Unknown',
      count: item.count || item.case_count || item.frequency || 0,
      percentage: item.percentage || item.pct_of_total || 0,
      details: item.details || item.description || '',
      reason_codes_included: item.reason_codes_included || item.reason_codes || [],
      booking_ids: item.booking_ids || item.case_ids || [],
    }));
  }

  return data;
}

async function processInsights(
  supabaseUrl: string,
  supabaseServiceKey: string,
  lovableApiKey: string,
  insightId: string,
  classifications: any[],
  extractions: any[],
  processedRecords: any[],
  dateRange: string,
  model: string,
  temperature: number,
  systemPrompt: string,
  triggeredByUserId: string | null
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[Insights] Background processing started for ${insightId} with ${classifications.length} records`);

    // Build combined data for Prompt C
    const recordSummaries = classifications.map((c: any, i: number) => {
      const extraction = extractions[i];
      const record = processedRecords[i] as any;
      return {
        ...c,
        booking_id: record?.id,
        member_name: extraction?.member_name || record?.member_name,
        length_of_stay: extraction?.length_of_stay,
        primary_reason_stated: extraction?.primary_reason_stated,
        issues_count: extraction?.issues_mentioned?.length || 0,
        blind_spots_count: extraction?.blind_spots?.length || 0,
        payment_was_factor: extraction?.payment_context?.payment_was_factor,
        transfer_considered: extraction?.transfer_context?.considered_transfer,
        host_mentioned: extraction?.host_context?.host_mentioned,
      };
    });

    // Handle batch sizing: split into chunks of 50
    const CHUNK_SIZE = 50;
    let finalResult: any;

    if (recordSummaries.length <= CHUNK_SIZE) {
      // Single batch
      const result = await callLovableAI(lovableApiKey, model, temperature, systemPrompt,
        `Date range: ${dateRange}\n\nHere are ${recordSummaries.length} classified move-out records:\n\n${JSON.stringify(recordSummaries, null, 2)}`
      );

      try {
        const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
        finalResult = JSON.parse(jsonMatch ? jsonMatch[1].trim() : result.content.trim());
      } catch {
        // Retry
        const retry = await callLovableAI(lovableApiKey, model, temperature, systemPrompt,
          `Date range: ${dateRange}\n\nHere are ${recordSummaries.length} classified move-out records:\n\n${JSON.stringify(recordSummaries, null, 2)}\n\nYour previous response was not valid JSON. Respond ONLY with the JSON object, no preamble, no markdown backticks.`
        );
        const retryMatch = retry.content.match(/```(?:json)?\s*([\s\S]*?)```/);
        finalResult = JSON.parse(retryMatch ? retryMatch[1].trim() : retry.content.trim());
      }

      await logApiCost(supabase, {
        service_provider: 'lovable_ai',
        service_type: 'research_aggregation',
        edge_function: 'generate-research-insights',
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        metadata: { model, prompt: 'C', records: recordSummaries.length },
        triggered_by_user_id: triggeredByUserId || undefined,
        is_internal: false,
      });
    } else {
      // Multi-batch: split and synthesize IN PARALLEL
      const chunks: any[][] = [];
      for (let i = 0; i < recordSummaries.length; i += CHUNK_SIZE) {
        chunks.push(recordSummaries.slice(i, i + CHUNK_SIZE));
      }

      console.log(`[Insights] Splitting ${recordSummaries.length} records into ${chunks.length} chunks (parallel)`);

      // Process all chunks in parallel
      const chunkPromises = chunks.map(async (chunk, i) => {
        console.log(`[Insights] Starting chunk ${i + 1}/${chunks.length} (${chunk.length} records)`);
        try {
          const result = await callLovableAI(lovableApiKey, model, temperature, systemPrompt,
            `Date range: ${dateRange}\nBatch ${i + 1} of ${chunks.length}\n\nHere are ${chunk.length} classified move-out records:\n\n${JSON.stringify(chunk, null, 2)}`
          );

          await logApiCost(supabase, {
            service_provider: 'lovable_ai',
            service_type: 'research_aggregation',
            edge_function: 'generate-research-insights',
            input_tokens: result.inputTokens,
            output_tokens: result.outputTokens,
            metadata: { model, prompt: 'C', chunk: i + 1, totalChunks: chunks.length },
            triggered_by_user_id: triggeredByUserId || undefined,
            is_internal: false,
          });

          const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[1].trim() : result.content.trim());
          console.log(`[Insights] Chunk ${i + 1} completed successfully`);
          return parsed;
        } catch (err) {
          console.error(`[Insights] Failed to process chunk ${i + 1}:`, err);
          return null;
        }
      });

      const allChunkResults = await Promise.all(chunkPromises);
      const chunkResults = allChunkResults.filter(Boolean);

      if (chunkResults.length === 0) {
        throw new Error('All chunks failed to process');
      }

      // Synthesize chunk results
      if (chunkResults.length === 1) {
        finalResult = chunkResults[0];
      } else {
        console.log(`[Insights] Synthesizing ${chunkResults.length} chunk results`);
        const SYNTHESIS_SCHEMA_REMINDER = `CRITICAL: Your response MUST use the EXACT JSON schema from your system prompt. Key requirements:
- issue_clusters: each must have cluster_name (no P0/P1 prefix), cluster_description, frequency (integer), pct_of_total (number), booking_ids (array of UUIDs), reason_codes_included (array), severity_distribution ({critical,high,medium,low}), representative_quotes (array), systemic_root_cause (string), recommended_action (OBJECT with action, owner, priority, expected_impact, effort, quick_win)
- reason_code_distribution.distribution: each must have reason_group, count, percentage, details, reason_codes_included, booking_ids
- All counts/percentages must reflect the TOTAL across all batches (${recordSummaries.length} records total)`;
        const synthesisResult = await callLovableAI(lovableApiKey, model, temperature, systemPrompt,
          `Date range: ${dateRange}\n\n${SYNTHESIS_SCHEMA_REMINDER}\n\nYou analyzed ${recordSummaries.length} records in ${chunkResults.length} batches. Merge these batch results into ONE unified report with accurate totals. Here are the original record summaries for computing booking_ids and frequencies:\n\n${JSON.stringify(recordSummaries.map(r => ({ booking_id: r.booking_id, primary_reason_code: r.primary_reason_code, addressability: r.addressability, severity: r.severity, preventability_score: r.preventability_score })))}\n\nBatch results to synthesize:\n\n${JSON.stringify(chunkResults, null, 2)}`
        );
        try {
          const jsonMatch = synthesisResult.content.match(/```(?:json)?\s*([\s\S]*?)```/);
          finalResult = JSON.parse(jsonMatch ? jsonMatch[1].trim() : synthesisResult.content.trim());
        } catch {
          finalResult = chunkResults[0]; // Fallback to first chunk
        }

        await logApiCost(supabase, {
          service_provider: 'lovable_ai',
          service_type: 'research_aggregation_synthesis',
          edge_function: 'generate-research-insights',
          input_tokens: synthesisResult.inputTokens,
          output_tokens: synthesisResult.outputTokens,
          metadata: { model, prompt: 'C_synthesis' },
          triggered_by_user_id: triggeredByUserId || undefined,
          is_internal: false,
        });
      }
    }

    // Normalize before storing
    finalResult = normalizeInsightData(finalResult, classifications.length);

    // Store results
    const { error: updateError } = await supabase
      .from('research_insights')
      .update({
        data: finalResult,
        status: 'completed',
        total_records_analyzed: classifications.length,
      })
      .eq('id', insightId);

    if (updateError) {
      throw new Error(`Failed to store insights: ${updateError.message}`);
    }

    console.log(`[Insights] Successfully completed insight ${insightId}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Insights] Error:`, errorMessage);

    await supabase
      .from('research_insights')
      .update({ status: 'failed', error_message: errorMessage })
      .eq('id', insightId);
  }
}

async function callLovableAI(
  apiKey: string,
  model: string,
  temperature: number,
  systemPrompt: string,
  userPrompt: string
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return {
    content: result.choices?.[0]?.message?.content || '',
    inputTokens: result.usage?.prompt_tokens || Math.ceil(userPrompt.length / 4),
    outputTokens: result.usage?.completion_tokens || Math.ceil((result.choices?.[0]?.message?.content || '').length / 4),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let insight: { id: string } | null = null;

  try {
    const { campaignId, dateRangeStart, dateRangeEnd, analysisPeriod } = await req.json();

    // Get user ID from JWT
    const authHeader = req.headers.get('Authorization') || '';
    let triggeredByUserId: string | null = null;
    if (authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(atob(token.split('.')[1]));
        triggeredByUserId = payload.sub || null;
      } catch { /* ignore */ }
    }

    // Fetch processed research records
    let query = supabase
      .from('bookings')
      .select(`
        id,
        booking_date,
        member_name,
        booking_transcriptions!inner (
          research_extraction,
          research_classification,
          research_processing_status
        )
      `)
      .eq('record_type', 'research')
      .eq('has_valid_conversation', true)
      .eq('booking_transcriptions.research_processing_status', 'completed');

    if (campaignId) {
      query = query.eq('research_call_id', campaignId);
    }
    if (dateRangeStart) {
      query = query.gte('booking_date', dateRangeStart);
    }
    if (dateRangeEnd) {
      query = query.lte('booking_date', dateRangeEnd);
    }

    const { data: records, error: fetchError } = await query;

    if (fetchError) throw new Error(`Failed to fetch records: ${fetchError.message}`);

    const processedRecords = (records || []).filter((r: any) => {
      const t = Array.isArray(r.booking_transcriptions) ? r.booking_transcriptions[0] : r.booking_transcriptions;
      return t?.research_classification;
    });

    if (processedRecords.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No processed research records found for the selected filters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const classifications = processedRecords.map((r: any) => {
      const t = Array.isArray(r.booking_transcriptions) ? r.booking_transcriptions[0] : r.booking_transcriptions;
      return t.research_classification;
    });

    const extractions = processedRecords.map((r: any) => {
      const t = Array.isArray(r.booking_transcriptions) ? r.booking_transcriptions[0] : r.booking_transcriptions;
      return t.research_extraction;
    });

    // Fetch prompt config
    const { data: prompts } = await supabase
      .from('research_prompts')
      .select('prompt_key, prompt_text, temperature, model');

    const aggPrompt = prompts?.find((p: any) => p.prompt_key === 'aggregation');
    const model = aggPrompt?.model || 'google/gemini-2.5-pro';
    const temperature = Number(aggPrompt?.temperature) || 0.4;
    const systemPrompt = aggPrompt?.prompt_text || DEFAULT_AGGREGATION_PROMPT;

    const dateRange = dateRangeStart && dateRangeEnd
      ? `${dateRangeStart} to ${dateRangeEnd}`
      : analysisPeriod || 'All Time';

    // Create insight record
    const { data: insightData, error: insertError } = await supabase
      .from('research_insights')
      .insert({
        campaign_id: campaignId || null,
        data: {},
        insight_type: 'aggregate',
        caller_type: null,
        status: 'processing',
        total_records_analyzed: processedRecords.length,
        analysis_period: analysisPeriod || 'custom',
        date_range_start: dateRangeStart || null,
        date_range_end: dateRangeEnd || null,
        created_by: triggeredByUserId,
      })
      .select('id')
      .single();

    if (insertError || !insightData) {
      throw new Error(`Failed to create insight record: ${insertError?.message}`);
    }

    insight = insightData;

    console.log(`[Insights] Created insight ${insight.id}, processing synchronously for ${processedRecords.length} records`);

    // Process synchronously within the request (300s HTTP timeout >> ~150s parallel processing)
    await processInsights(
      supabaseUrl,
      supabaseServiceKey,
      lovableApiKey,
      insight.id,
      classifications,
      extractions,
      processedRecords,
      dateRange,
      model,
      temperature,
      systemPrompt,
      triggeredByUserId
    );

    return new Response(
      JSON.stringify({
        success: true,
        insightId: insight.id,
        recordCount: processedRecords.length,
        message: 'Insight generation completed',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Insights] Error:`, errorMessage);

    // Failsafe: mark insight as failed if it was created but processing errored/timed out
    if (insight?.id) {
      try {
        await supabase
          .from('research_insights')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', insight.id);
        console.log(`[Insights] Marked insight ${insight.id} as failed`);
      } catch (updateErr) {
        console.error(`[Insights] Failed to mark insight as failed:`, updateErr);
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
