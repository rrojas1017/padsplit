import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

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
  "reason_code_distribution": [
    { "code": "Reason code", "count": 0, "pct": 0.0, "avg_preventability": 0.0, "booking_ids": ["booking-uuid-1"], "reason_codes_included": ["GRANULAR_CODE_1"] }
  ],
  "issue_clusters": [
    {
      "cluster_name": "Clear theme name",
      "cluster_description": "2-3 sentences",
      "frequency": 0,
      "pct_of_total": 0.0,
      "reason_codes_included": [],
      "booking_ids": [],
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
8. BOOKING IDS — each record has a "_booking_id" field. Include the array of booking IDs in "reason_code_distribution" and "issue_clusters" so the UI can trace back to individual records. Also include "reason_codes_included" listing the granular primary_reason_code values grouped into each category.`;

// Programmatic merge fallback: combines chunk results by concatenating arrays and averaging numbers
function programmaticMerge(chunkResults: any[]): any {
  if (chunkResults.length === 0) return {};
  if (chunkResults.length === 1) return chunkResults[0];

  const base = JSON.parse(JSON.stringify(chunkResults[0]));

  // Merge executive_summary: sum counts, average percentages
  if (base.executive_summary) {
    const summaries = chunkResults.map(c => c.executive_summary).filter(Boolean);
    const totalCases = summaries.reduce((s: number, e: any) => s + (e.total_cases || 0), 0);
    base.executive_summary.total_cases = totalCases;
    for (const pctKey of ['addressable_pct', 'non_addressable_pct', 'partially_addressable_pct', 'avg_preventability_score', 'high_regret_pct', 'payment_related_pct', 'host_related_pct', 'roommate_related_pct', 'life_event_pct']) {
      const vals = summaries.map((e: any) => e[pctKey]).filter((v: any) => typeof v === 'number');
      if (vals.length > 0) base.executive_summary[pctKey] = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
    }
    base.executive_summary.high_regret_count = summaries.reduce((s: number, e: any) => s + (e.high_regret_count || 0), 0);
  }

  // Merge array sections by concatenation and dedup by name/code
  const arrayKeys = ['reason_code_distribution', 'issue_clusters', 'emerging_patterns', 'operational_blind_spots', 'host_accountability_flags', 'top_actions'];
  for (const key of arrayKeys) {
    const allItems = chunkResults.flatMap(c => c[key] || []);
    base[key] = allItems;
  }

  // Merge object sections: agent_performance_summary
  if (base.agent_performance_summary) {
    const perfs = chunkResults.map(c => c.agent_performance_summary).filter(Boolean);
    base.agent_performance_summary.total_calls_reviewed = perfs.reduce((s: number, p: any) => s + (p.total_calls_reviewed || 0), 0);
    const avgQs = perfs.map((p: any) => p.avg_questions_covered).filter((v: any) => typeof v === 'number');
    if (avgQs.length) base.agent_performance_summary.avg_questions_covered = avgQs.reduce((a: number, b: number) => a + b, 0) / avgQs.length;
    base.agent_performance_summary.commonly_skipped_sections = [...new Set(perfs.flatMap((p: any) => p.commonly_skipped_sections || []))];
    base.agent_performance_summary.positive_patterns = [...new Set(perfs.flatMap((p: any) => p.positive_patterns || []))];
    base.agent_performance_summary.coaching_opportunities = [...new Set(perfs.flatMap((p: any) => p.coaching_opportunities || []))];
  }

  // Re-rank top_actions
  if (base.top_actions) {
    base.top_actions.sort((a: any, b: any) => (b.cases_affected || 0) - (a.cases_affected || 0));
    base.top_actions = base.top_actions.slice(0, 10).map((a: any, i: number) => ({ ...a, rank: i + 1 }));
  }

  return base;
}

async function processInsights(
  supabaseUrl: string,
  supabaseServiceKey: string,
  lovableApiKey: string,
  insightId: string,
  classifications: any[],
  extractions: any[],
  dateRange: string,
  model: string,
  temperature: number,
  systemPrompt: string,
  triggeredByUserId: string | null
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Helper to write progress to the data column
  async function updateProgress(phase: string, completedChunks: number, totalChunks: number) {
    try {
      await supabase.from('research_insights').update({
        data: { _progress: { totalChunks, completedChunks, totalRecords: classifications.length, currentPhase: phase } }
      }).eq('id', insightId);
    } catch (e) { console.error('[Insights] Progress update failed:', e); }
  }

  try {
    console.log(`[Insights] Background processing started for ${insightId} with ${classifications.length} records`);

    // Build combined data for Prompt C
    const recordSummaries = classifications.map((c: any, i: number) => {
      const extraction = extractions[i];
      return {
        ...c,
        // Include key extraction fields for richer context
        member_name: extraction?.member_name,
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
      await updateProgress('analyzing', 0, 1);
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
      // Multi-batch: split and synthesize
      const chunks: any[][] = [];
      for (let i = 0; i < recordSummaries.length; i += CHUNK_SIZE) {
        chunks.push(recordSummaries.slice(i, i + CHUNK_SIZE));
      }

      console.log(`[Insights] Splitting ${recordSummaries.length} records into ${chunks.length} chunks`);
      const chunkResults: any[] = [];
      await updateProgress('analyzing', 0, chunks.length);

      for (let i = 0; i < chunks.length; i++) {
        console.log(`[Insights] Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} records)`);
        const result = await callLovableAI(lovableApiKey, model, temperature, systemPrompt,
          `Date range: ${dateRange}\nBatch ${i + 1} of ${chunks.length}\n\nHere are ${chunks[i].length} classified move-out records:\n\n${JSON.stringify(chunks[i], null, 2)}`
        );

        try {
          const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
          chunkResults.push(JSON.parse(jsonMatch ? jsonMatch[1].trim() : result.content.trim()));
        } catch {
          console.error(`[Insights] Failed to parse chunk ${i + 1} result`);
        }

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

        await updateProgress('analyzing', i + 1, chunks.length);
      }

      // Synthesize chunk results
      if (chunkResults.length === 1) {
        finalResult = chunkResults[0];
      } else {
        console.log(`[Insights] Synthesizing ${chunkResults.length} chunk results`);
        await updateProgress('synthesizing', chunks.length, chunks.length);

        // Use Flash for synthesis (faster) with a 90s timeout fallback
        const synthesisModel = 'google/gemini-2.5-flash';
        const synthesisPromise = callLovableAI(lovableApiKey, synthesisModel, temperature, systemPrompt,
          `Date range: ${dateRange}\n\nYou previously analyzed ${recordSummaries.length} records in ${chunkResults.length} batches. Synthesize these batch results into a single unified insight report:\n\n${JSON.stringify(chunkResults, null, 2)}`
        );
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('synthesis_timeout')), 90000)
        );

        try {
          const synthesisResult = await Promise.race([synthesisPromise, timeoutPromise]);
          try {
            const jsonMatch = synthesisResult.content.match(/```(?:json)?\s*([\s\S]*?)```/);
            finalResult = JSON.parse(jsonMatch ? jsonMatch[1].trim() : synthesisResult.content.trim());
          } catch {
            console.warn('[Insights] Failed to parse synthesis JSON, using programmatic merge');
            finalResult = programmaticMerge(chunkResults);
          }

          await logApiCost(supabase, {
            service_provider: 'lovable_ai',
            service_type: 'research_aggregation_synthesis',
            edge_function: 'generate-research-insights',
            input_tokens: synthesisResult.inputTokens,
            output_tokens: synthesisResult.outputTokens,
            metadata: { model: synthesisModel, prompt: 'C_synthesis' },
            triggered_by_user_id: triggeredByUserId || undefined,
            is_internal: false,
          });
        } catch (synthError: any) {
          if (synthError?.message === 'synthesis_timeout') {
            console.warn('[Insights] Synthesis timed out after 90s, using programmatic merge');
            finalResult = programmaticMerge(chunkResults);
          } else {
            throw synthError;
          }
        }
      }
    }

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
      return { ...t.research_classification, _booking_id: r.id };
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

    // Concurrent invocation guard: check for existing processing records
    const { data: existingProcessing } = await supabase
      .from('research_insights')
      .select('id, created_at')
      .eq('status', 'processing')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingProcessing) {
      const createdAt = new Date(existingProcessing.created_at).getTime();
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      if (createdAt >= thirtyMinutesAgo) {
        return new Response(
          JSON.stringify({ success: false, error: 'An analysis is already in progress. Please wait for it to complete.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Stale record — mark as failed
      await supabase.from('research_insights')
        .update({ status: 'failed', error_message: 'Timed out during processing' })
        .eq('id', existingProcessing.id);
      console.log(`[Insights] Marked stale record ${existingProcessing.id} as failed`);
    }

    // Create insight record
    const { data: insight, error: insertError } = await supabase
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

    if (insertError || !insight) {
      throw new Error(`Failed to create insight record: ${insertError?.message}`);
    }

    console.log(`[Insights] Created insight ${insight.id}, starting background processing for ${processedRecords.length} records`);

    // Background processing
    EdgeRuntime.waitUntil(
      processInsights(
        supabaseUrl,
        supabaseServiceKey,
        lovableApiKey,
        insight.id,
        classifications,
        extractions,
        dateRange,
        model,
        temperature,
        systemPrompt,
        triggeredByUserId
      )
    );

    return new Response(
      JSON.stringify({
        success: true,
        insightId: insight.id,
        recordCount: processedRecords.length,
        message: 'Insight generation started',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Insights] Error:`, errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
