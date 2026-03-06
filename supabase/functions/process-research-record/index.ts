import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cost logging helper
async function logApiCost(supabase: any, params: {
  service_provider: string;
  service_type: string;
  edge_function: string;
  booking_id?: string;
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

// Call Lovable AI gateway
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

// Parse JSON with retry
async function parseJsonWithRetry(
  content: string,
  apiKey: string,
  model: string,
  temperature: number,
  systemPrompt: string,
  userPrompt: string
): Promise<any> {
  try {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleanContent = jsonMatch ? jsonMatch[1].trim() : content.trim();
    return JSON.parse(cleanContent);
  } catch {
    console.warn('[Parse] First attempt failed, retrying with correction prompt...');
    const retryResult = await callLovableAI(
      apiKey,
      model,
      temperature,
      systemPrompt,
      userPrompt + '\n\nYour previous response was not valid JSON. Respond ONLY with the JSON object, no preamble, no markdown backticks, no explanation before or after.'
    );
    const retryMatch = retryResult.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const retryClean = retryMatch ? retryMatch[1].trim() : retryResult.content.trim();
    return JSON.parse(retryClean);
  }
}

// ── Default merged prompt (combines extraction + classification in one call) ──

const DEFAULT_MERGED_PROMPT = `You are a qualitative research analyst and housing operations classifier at PadSplit. You are processing a transcribed move-out interview between a PadSplit agent and a former member. The transcript is from automated speech-to-text — expect false starts, crosstalk, filler words, tangents, and garbled text. Focus on substance.

You will perform TWO tasks in a single pass:
1. **Extract** structured data from the transcript (issues, context, quotes, agent observations).
2. **Classify** the case using PadSplit's internal framework (reason codes, preventability, addressability).

Respond with ONLY a JSON object containing two top-level keys: "extraction" and "classification". No preamble, no markdown, no explanation.

{
  "extraction": {
    "member_name": "string or null",
    "member_id": "string or null",
    "agent_name": "string or null",
    "length_of_stay": "string or null",
    "phone_number": "string or null",
    "primary_reason_stated": "The member's own explanation of why they left, condensed to 1-3 sentences using their framing and language.",
    "primary_reason_interpreted": "Your analytical interpretation of the TRUE root cause. Apply the Stressor → Failure Point → Breaking Point framework.",
    "trigger_type": "gradual | single_event | external_life_change | compound",
    "trigger_description": "What specifically happened or changed",
    "issues_mentioned": [
      {
        "issue": "Short clear description",
        "category": "maintenance | host_behavior | roommate_conflict | payment_difficulty | employment | safety | cleanliness | communication | policy_confusion | transfer_friction | life_change | other",
        "severity_expressed": "low | medium | high | critical",
        "was_reported_to_padsplit": true,
        "padsplit_response_if_reported": "What happened when they reported it, or null",
        "escalated_over_time": false,
        "quotes": ["direct quotes"]
      }
    ],
    "payment_context": {
      "payment_was_factor": false,
      "employment_related": false,
      "extension_requested": false,
      "extension_experience": null,
      "miscommunication_present": false,
      "miscommunication_details": null,
      "outstanding_balance": null,
      "balance_blocking_return": false,
      "pattern_of_nonpayment": false,
      "third_party_payments": false
    },
    "transfer_context": {
      "considered_transfer": false,
      "aware_of_option": false,
      "barrier_to_transfer": null,
      "transfer_would_have_retained": null
    },
    "host_context": {
      "host_mentioned": false,
      "host_sentiment": "not_mentioned",
      "host_issues": [],
      "host_responsiveness": "not_discussed",
      "host_legal_concerns": null
    },
    "roommate_context": {
      "roommate_issues": false,
      "nature_of_conflict": null,
      "was_reported": false,
      "why_not_reported": null
    },
    "blind_spots": [],
    "improvement_suggestions": [],
    "would_return_to_padsplit": "unclear",
    "return_conditions": null,
    "emotional_tone": "neutral",
    "agent_observations": {
      "questions_covered_estimate": "0",
      "sections_skipped": [],
      "agent_stayed_on_script": false,
      "agent_offered_solutions": false,
      "agent_made_promises": false,
      "agent_probed_deeper": false,
      "notable_agent_behavior": null
    },
    "key_quotes": [],
    "confidence_flags": []
  },
  "classification": {
    "primary_reason_code": "EXACTLY one of: Transfer Denied / Couldn't Transfer | Maintenance Delays | Roommate Conflict | Safety Concern | Noise or Cleanliness Issues | Communication Breakdown / Support Dissatisfaction | Policy Confusion / Lack of Flexibility | Payment Extension Not Offered | Collections – No Flexibility | Pattern of Non-Payment | Job Relocation | Moving in with Family | Buying a Home | Health Issues | Immigration Changes | Marriage | Military Relocation | Fraud / Misrepresentation | Host Negligence / Property Condition | Other",
    "primary_reason_detail": "1-2 sentences on why this code was chosen",
    "secondary_reason_codes": [],
    "addressability": "Addressable | Non-addressable | Partially addressable",
    "addressability_rationale": "2-3 sentences",
    "regrettability": "High | Medium | Low",
    "regrettability_rationale": "2-3 sentences",
    "preventability_score": 5,
    "preventability_rationale": "2-3 sentences",
    "experience_deterioration": "gradual | trigger_event | compound",
    "categorization_framework": "Addressable | Non-addressable | Non-regrettable but addressable | Regrettable (non-fraud) | Regrettable fraud | Non-regrettable (policy/collections)",
    "early_warning_signals": [
      {
        "signal": "The detectable signal",
        "when_it_appeared": "When in the member journey",
        "was_it_caught": "Yes | Partially | No",
        "what_should_have_happened": "The ideal system response"
      }
    ],
    "intervention_opportunities": [
      {
        "moment": "The specific window",
        "action": "Concrete implementable action",
        "likelihood_of_retention": "high | medium | low",
        "department_responsible": "support | host_ops | product | payments | trust_safety | retention"
      }
    ],
    "blind_spots": [],
    "key_quotes": [],
    "root_cause_summary": "2-3 sentences a VP could read in 10 seconds.",
    "what_we_could_have_done": "2-3 sentences.",
    "agent_performance_notes": "Coverage and quality notes.",
    "case_brief": "150-200 word narrative summary using Stressor → Failure Point → Breaking Point framework.",
    "human_review_recommended": false,
    "human_review_reason": null
  }
}

EXTRACTION RULES:
- If information is not in the transcript, use null. NEVER fabricate.
- Extract ALL issues mentioned, even tangential ones.
- For blind_spots, be thorough — look for silent suffering, assumptions about PadSplit's limitations, information gaps.
- For quotes, use EXACT words from the transcript.
- When ambiguous, use confidence_flags rather than presenting interpretation as fact.
- Record the member's stated reason exactly as they expressed it in "primary_reason_stated".
- In "primary_reason_interpreted", note ONLY if other evidence in the transcript contradicts or complicates the stated reason. Cite the specific evidence.
- If no contradicting evidence exists, "primary_reason_interpreted" should match the stated reason.
- Do NOT assume hidden motivations. Flag discrepancies only when the transcript itself provides conflicting signals.
- Use "confidence_flags" to note any ambiguity rather than choosing an interpretation.

CLASSIFICATION RULES:
1. PRIMARY CODE = the issue which, if resolved, would MOST LIKELY have retained the member.
2. PREVENTABILITY SCORING: 9-10: Clear signals, tools to intervene, failed to act. 7-8: Possible with proactive changes. 5-6: Partially preventable. 3-4: Mostly external. 1-2: Fully external.
3. REGRETTABILITY: High = engaged member we should have kept. Low = departure was inevitable or acceptable.
4. FLAG FOR HUMAN REVIEW when: transcript is ambiguous, contradictory, involves legal issues, or uncertain between primary codes.
5. Base your classification on what the member ACTUALLY said in the transcript. If the extraction shows weak or ambiguous evidence for the primary reason, reduce the preventability score accordingly.`;

// Legacy default prompts (kept for fallback if separate extraction/classification prompts exist in DB)
const DEFAULT_EXTRACTION_PROMPT = `You are a qualitative research analyst processing a transcribed move-out interview between a PadSplit agent and a former member. The transcript is from automated speech-to-text — expect false starts, crosstalk, filler words, tangents, and garbled text. Focus on substance.

Respond with ONLY the JSON object below. No preamble, no markdown, no explanation.

{
  "member_name": "string or null",
  "member_id": "string or null",
  "agent_name": "string or null",
  "length_of_stay": "string or null",
  "phone_number": "string or null",
  "primary_reason_stated": "The member's own explanation of why they left, condensed to 1-3 sentences using their framing and language.",
  "primary_reason_interpreted": "Your analytical interpretation of the TRUE root cause. Apply the Stressor → Failure Point → Breaking Point framework.",
  "trigger_type": "gradual | single_event | external_life_change | compound",
  "trigger_description": "What specifically happened or changed",
  "issues_mentioned": [
    {
      "issue": "Short clear description",
      "category": "maintenance | host_behavior | roommate_conflict | payment_difficulty | employment | safety | cleanliness | communication | policy_confusion | transfer_friction | life_change | other",
      "severity_expressed": "low | medium | high | critical",
      "was_reported_to_padsplit": true,
      "padsplit_response_if_reported": "What happened when they reported it, or null",
      "escalated_over_time": false,
      "quotes": ["direct quotes"]
    }
  ],
  "payment_context": {
    "payment_was_factor": false,
    "employment_related": false,
    "extension_requested": false,
    "extension_experience": null,
    "miscommunication_present": false,
    "miscommunication_details": null,
    "outstanding_balance": null,
    "balance_blocking_return": false,
    "pattern_of_nonpayment": false,
    "third_party_payments": false
  },
  "transfer_context": {
    "considered_transfer": false,
    "aware_of_option": false,
    "barrier_to_transfer": null,
    "transfer_would_have_retained": null
  },
  "host_context": {
    "host_mentioned": false,
    "host_sentiment": "not_mentioned",
    "host_issues": [],
    "host_responsiveness": "not_discussed",
    "host_legal_concerns": null
  },
  "roommate_context": {
    "roommate_issues": false,
    "nature_of_conflict": null,
    "was_reported": false,
    "why_not_reported": null
  },
  "blind_spots": [],
  "improvement_suggestions": [],
  "would_return_to_padsplit": "unclear",
  "return_conditions": null,
  "emotional_tone": "neutral",
  "agent_observations": {
    "questions_covered_estimate": "0",
    "sections_skipped": [],
    "agent_stayed_on_script": false,
    "agent_offered_solutions": false,
    "agent_made_promises": false,
    "agent_probed_deeper": false,
    "notable_agent_behavior": null
  },
  "key_quotes": [],
  "confidence_flags": []
}

RULES:
- If information is not in the transcript, use null. NEVER fabricate.
- Extract ALL issues mentioned, even tangential ones.
- For blind_spots, be thorough — look for silent suffering, assumptions about PadSplit's limitations, information gaps.
- For quotes, use EXACT words from the transcript.
- When ambiguous, use confidence_flags rather than presenting interpretation as fact.

DISCREPANCY FLAGGING:
- Record the member's stated reason exactly as they expressed it in "primary_reason_stated".
- In "primary_reason_interpreted", note ONLY if other evidence in the transcript contradicts or complicates the stated reason. Cite the specific evidence.
- If no contradicting evidence exists, "primary_reason_interpreted" should match the stated reason.
- Do NOT assume hidden motivations. Flag discrepancies only when the transcript itself provides conflicting signals.
- Use "confidence_flags" to note any ambiguity rather than choosing an interpretation.`;

const DEFAULT_CLASSIFICATION_PROMPT = `You are a housing operations analyst at PadSplit. You are receiving structured extraction data from a member move-out interview. Classify this case using PadSplit's internal framework.

Input: the JSON extraction from the previous processing step.

Respond with ONLY the JSON object below. No preamble, no markdown, no explanation.

{
  "primary_reason_code": "EXACTLY one of: Transfer Denied / Couldn't Transfer | Maintenance Delays | Roommate Conflict | Safety Concern | Noise or Cleanliness Issues | Communication Breakdown / Support Dissatisfaction | Policy Confusion / Lack of Flexibility | Payment Extension Not Offered | Collections – No Flexibility | Pattern of Non-Payment | Job Relocation | Moving in with Family | Buying a Home | Health Issues | Immigration Changes | Marriage | Military Relocation | Fraud / Misrepresentation | Host Negligence / Property Condition | Other",
  "primary_reason_detail": "1-2 sentences on why this code was chosen",
  "secondary_reason_codes": [],
  "addressability": "Addressable | Non-addressable | Partially addressable",
  "addressability_rationale": "2-3 sentences",
  "regrettability": "High | Medium | Low",
  "regrettability_rationale": "2-3 sentences",
  "preventability_score": 5,
  "preventability_rationale": "2-3 sentences",
  "experience_deterioration": "gradual | trigger_event | compound",
  "categorization_framework": "Addressable | Non-addressable | Non-regrettable but addressable | Regrettable (non-fraud) | Regrettable fraud | Non-regrettable (policy/collections)",
  "early_warning_signals": [
    {
      "signal": "The detectable signal",
      "when_it_appeared": "When in the member journey",
      "was_it_caught": "Yes | Partially | No",
      "what_should_have_happened": "The ideal system response"
    }
  ],
  "intervention_opportunities": [
    {
      "moment": "The specific window",
      "action": "Concrete implementable action",
      "likelihood_of_retention": "high | medium | low",
      "department_responsible": "support | host_ops | product | payments | trust_safety | retention"
    }
  ],
  "blind_spots": [],
  "key_quotes": [],
  "root_cause_summary": "2-3 sentences a VP could read in 10 seconds.",
  "what_we_could_have_done": "2-3 sentences.",
  "agent_performance_notes": "Coverage and quality notes.",
  "case_brief": "150-200 word narrative summary using Stressor → Failure Point → Breaking Point framework.",
  "human_review_recommended": false,
  "human_review_reason": null
}

CLASSIFICATION RULES:
1. PRIMARY CODE = the issue which, if resolved, would MOST LIKELY have retained the member.
2. PREVENTABILITY SCORING: 9-10: Clear signals, tools to intervene, failed to act. 7-8: Possible with proactive changes. 5-6: Partially preventable. 3-4: Mostly external. 1-2: Fully external.
3. REGRETTABILITY: High = engaged member we should have kept. Low = departure was inevitable or acceptable.
4. FLAG FOR HUMAN REVIEW when: transcript is ambiguous, contradictory, involves legal issues, or uncertain between primary codes.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { bookingId } = await req.json();
    if (!bookingId) throw new Error('Missing bookingId');

    console.log(`[Research] Processing record for booking ${bookingId}`);

    // Check if booking has a valid conversation
    const { data: booking } = await supabase
      .from('bookings')
      .select('has_valid_conversation')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking?.has_valid_conversation) {
      console.log(`[Research] Skipping ${bookingId} — not a valid conversation (voicemail/brief attempt)`);
      return new Response(
        JSON.stringify({ success: false, reason: 'Not a valid conversation', bookingId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch transcript
    const { data: transcription, error: fetchError } = await supabase
      .from('booking_transcriptions')
      .select('id, call_transcription, research_processing_status, updated_at')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (fetchError || !transcription) {
      throw new Error(`No transcription found for booking ${bookingId}`);
    }

    if (!transcription.call_transcription) {
      throw new Error(`Empty transcript for booking ${bookingId}`);
    }

    // Allow re-processing if stuck in 'processing' for >15 minutes (stale)
    if (transcription.research_processing_status === 'processing') {
      const updatedAt = new Date(transcription.updated_at || 0);
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (updatedAt > fifteenMinutesAgo) {
        return new Response(
          JSON.stringify({ success: false, reason: 'Already processing' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`[Research] Record ${bookingId} stuck in processing since ${updatedAt.toISOString()}, resetting and retrying`);
    }

    // Mark as processing
    await supabase
      .from('booking_transcriptions')
      .update({ research_processing_status: 'processing' })
      .eq('booking_id', bookingId);

    // Fetch custom prompts from research_prompts table
    const { data: prompts } = await supabase
      .from('research_prompts')
      .select('prompt_key, prompt_text, temperature, model');

    const mergedPromptRow = prompts?.find((p: any) => p.prompt_key === 'merged');
    const extractionPromptRow = prompts?.find((p: any) => p.prompt_key === 'extraction');
    const classificationPromptRow = prompts?.find((p: any) => p.prompt_key === 'classification');

    // Decide processing mode: merged (new) or legacy two-step
    const useMerged = !!mergedPromptRow || (!extractionPromptRow && !classificationPromptRow);

    let extraction: any;
    let classification: any;

    if (useMerged) {
      // ── MERGED SINGLE-CALL MODE ──
      const systemPrompt = mergedPromptRow?.prompt_text || DEFAULT_MERGED_PROMPT;
      const model = mergedPromptRow?.model || 'google/gemini-2.5-flash';
      const temperature = Number(mergedPromptRow?.temperature) || 0.2;

      console.log(`[Research] Running MERGED prompt (${model}) for ${bookingId}`);
      const result = await callLovableAI(
        lovableApiKey,
        model,
        temperature,
        systemPrompt,
        `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
      );

      const parsed = await parseJsonWithRetry(
        result.content,
        lovableApiKey,
        model,
        temperature,
        systemPrompt,
        `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
      );

      extraction = parsed.extraction || parsed;
      classification = parsed.classification;

      // If classification is missing, mark for human review
      if (!classification) {
        console.warn(`[Research] Merged output missing 'classification' key for ${bookingId}, marking for human review`);
        classification = { human_review_recommended: true, human_review_reason: 'Merged prompt did not return classification' };
      }

      console.log(`[Research] Merged prompt complete. Primary code: ${classification.primary_reason_code}, Issues: ${extraction.issues_mentioned?.length || 0}`);

      // Log single cost entry
      await logApiCost(supabase, {
        service_provider: 'lovable_ai',
        service_type: 'research_merged',
        edge_function: 'process-research-record',
        booking_id: bookingId,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        metadata: { model, prompt: 'merged' },
        is_internal: false,
      });

    } else {
      // ── LEGACY TWO-STEP MODE (for users who customized separate prompts) ──
      const extractionSystemPrompt = extractionPromptRow?.prompt_text || DEFAULT_EXTRACTION_PROMPT;
      const extractionModel = extractionPromptRow?.model || 'google/gemini-2.5-flash';
      const extractionTemp = Number(extractionPromptRow?.temperature) || 0.2;

      const classificationSystemPrompt = classificationPromptRow?.prompt_text || DEFAULT_CLASSIFICATION_PROMPT;
      const classificationModel = classificationPromptRow?.model || 'google/gemini-2.5-pro';
      const classificationTemp = Number(classificationPromptRow?.temperature) || 0.2;

      // Prompt A: Extraction
      console.log(`[Research] Running Prompt A (extraction, legacy) for ${bookingId}`);
      const extractionResult = await callLovableAI(
        lovableApiKey, extractionModel, extractionTemp, extractionSystemPrompt,
        `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
      );

      extraction = await parseJsonWithRetry(
        extractionResult.content, lovableApiKey, extractionModel, extractionTemp,
        extractionSystemPrompt, `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
      );

      await logApiCost(supabase, {
        service_provider: 'lovable_ai', service_type: 'research_extraction',
        edge_function: 'process-research-record', booking_id: bookingId,
        input_tokens: extractionResult.inputTokens, output_tokens: extractionResult.outputTokens,
        metadata: { model: extractionModel, prompt: 'A' }, is_internal: false,
      });

      // Prompt B: Classification
      console.log(`[Research] Running Prompt B (classification, legacy) for ${bookingId}`);
      const classificationResult = await callLovableAI(
        lovableApiKey, classificationModel, classificationTemp, classificationSystemPrompt,
        `Here is the structured extraction to classify:\n\n${JSON.stringify(extraction, null, 2)}`
      );

      classification = await parseJsonWithRetry(
        classificationResult.content, lovableApiKey, classificationModel, classificationTemp,
        classificationSystemPrompt, `Here is the structured extraction to classify:\n\n${JSON.stringify(extraction, null, 2)}`
      );

      await logApiCost(supabase, {
        service_provider: 'lovable_ai', service_type: 'research_classification',
        edge_function: 'process-research-record', booking_id: bookingId,
        input_tokens: classificationResult.inputTokens, output_tokens: classificationResult.outputTokens,
        metadata: { model: classificationModel, prompt: 'B' }, is_internal: false,
      });
    }

    // Store results (same columns regardless of mode)
    const { error: updateError } = await supabase
      .from('booking_transcriptions')
      .update({
        research_extraction: extraction,
        research_classification: classification,
        research_processed_at: new Date().toISOString(),
        research_processing_status: 'completed',
        research_human_review: classification.human_review_recommended === true,
      })
      .eq('booking_id', bookingId);

    if (updateError) {
      throw new Error(`Failed to store results: ${updateError.message}`);
    }

    console.log(`[Research] Successfully processed booking ${bookingId}. Human review: ${classification.human_review_recommended}`);

    return new Response(
      JSON.stringify({
        success: true,
        bookingId,
        primaryReasonCode: classification.primary_reason_code,
        preventabilityScore: classification.preventability_score,
        humanReviewRecommended: classification.human_review_recommended,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Research] Error:`, errorMessage);

    // Try to update status to failed
    try {
      const { bookingId } = await req.clone().json();
      if (bookingId) {
        await supabase
          .from('booking_transcriptions')
          .update({ research_processing_status: 'failed' })
          .eq('booking_id', bookingId);
      }
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
