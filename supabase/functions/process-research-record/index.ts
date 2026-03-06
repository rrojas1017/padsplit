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

// Fetch member history from system data for data-driven preventability scoring
async function fetchMemberHistory(supabase: any, bookingId: string, extraction: any): Promise<{
  context: string;
  factors: Record<string, any>;
}> {
  const phoneNumber = extraction?.phone_number;
  const memberName = extraction?.member_name;

  if (!phoneNumber && !memberName) {
    console.log('[History] No phone or name extracted, skipping history lookup');
    return { context: '', factors: {} };
  }

  try {
    // 1. Find all bookings for this member (by phone or name match)
    let bookingsQuery = supabase
      .from('bookings')
      .select('id, status, booking_date, move_in_date, contact_phone, contact_email, member_name, detected_issues, record_type, created_at')
      .neq('id', bookingId)
      .order('booking_date', { ascending: true });

    if (phoneNumber) {
      bookingsQuery = bookingsQuery.eq('contact_phone', phoneNumber);
    } else {
      bookingsQuery = bookingsQuery.ilike('member_name', memberName);
    }

    const { data: priorBookings } = await bookingsQuery.limit(50);
    const memberBookings = priorBookings || [];

    // 2. Gather all booking IDs for communication lookups
    const allBookingIds = memberBookings.map((b: any) => b.id);

    // 3. Fetch communications sent to this member
    let communications: any[] = [];
    if (allBookingIds.length > 0) {
      const { data: comms } = await supabase
        .from('contact_communications')
        .select('communication_type, sent_at, message_preview')
        .in('booking_id', allBookingIds)
        .order('sent_at', { ascending: false })
        .limit(20);
      communications = comms || [];
    }

    // 4. Fetch prior transcription analysis (detected issues, agent feedback)
    let priorAnalysis: any[] = [];
    if (allBookingIds.length > 0) {
      const { data: transcriptions } = await supabase
        .from('booking_transcriptions')
        .select('booking_id, agent_feedback, qa_scores, research_classification')
        .in('booking_id', allBookingIds)
        .limit(20);
      priorAnalysis = transcriptions || [];
    }

    // 5. Collect all detected issues from prior bookings
    const allDetectedIssues: string[] = [];
    for (const b of memberBookings) {
      if (b.detected_issues && Array.isArray(b.detected_issues)) {
        for (const issue of b.detected_issues) {
          const label = typeof issue === 'string' ? issue : issue?.issue || issue?.category || JSON.stringify(issue);
          allDetectedIssues.push(label);
        }
      }
    }

    // 6. Calculate tenure
    const firstBookingDate = memberBookings.length > 0 ? new Date(memberBookings[0].booking_date || memberBookings[0].created_at) : null;
    const tenureDays = firstBookingDate ? Math.floor((Date.now() - firstBookingDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    // 7. Status breakdown
    const statusCounts: Record<string, number> = {};
    for (const b of memberBookings) {
      statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
    }

    // 8. Check for prior research classifications
    const priorReasonCodes: string[] = [];
    for (const t of priorAnalysis) {
      if (t.research_classification?.primary_reason_code) {
        priorReasonCodes.push(t.research_classification.primary_reason_code);
      }
    }

    // 9. Check current booking issues from extraction against known issues
    const extractedIssueCategories = (extraction?.issues_mentioned || []).map((i: any) => i.category).filter(Boolean);
    const issueWasPreviouslyKnown = extractedIssueCategories.some((cat: string) =>
      allDetectedIssues.some(known => known.toLowerCase().includes(cat.toLowerCase()))
    );

    // Build factors object
    const factors = {
      prior_bookings_count: memberBookings.length,
      booking_statuses: statusCounts,
      communications_sent: communications.length,
      communication_types: [...new Set(communications.map((c: any) => c.communication_type))],
      known_issues_before_departure: [...new Set(allDetectedIssues)],
      issue_was_previously_reported: issueWasPreviouslyKnown,
      time_as_member_days: tenureDays,
      prior_reason_codes: priorReasonCodes,
      has_prior_agent_feedback: priorAnalysis.some((t: any) => t.agent_feedback !== null),
    };

    // Build context string for Prompt B
    const contextLines: string[] = [];
    contextLines.push(`Member tenure: ${tenureDays} days (first booking: ${firstBookingDate?.toISOString().split('T')[0] || 'unknown'})`);
    contextLines.push(`Prior bookings: ${memberBookings.length} (Statuses: ${JSON.stringify(statusCounts)})`);
    contextLines.push(`Communications sent to member: ${communications.length} (Types: ${factors.communication_types.join(', ') || 'none'})`);
    
    if (communications.length > 0) {
      const recentComms = communications.slice(0, 5);
      contextLines.push(`Recent communications:`);
      for (const c of recentComms) {
        contextLines.push(`  - ${c.communication_type} on ${new Date(c.sent_at).toISOString().split('T')[0]}: "${(c.message_preview || '').substring(0, 100)}"`);
      }
    }

    if (allDetectedIssues.length > 0) {
      contextLines.push(`Previously detected issues from other calls: ${[...new Set(allDetectedIssues)].join(', ')}`);
    }

    if (issueWasPreviouslyKnown) {
      contextLines.push(`⚠️ IMPORTANT: At least one issue mentioned in this interview was ALREADY KNOWN from prior system data.`);
    }

    if (priorReasonCodes.length > 0) {
      contextLines.push(`Prior research classifications: ${priorReasonCodes.join(', ')}`);
    }

    console.log(`[History] Found ${memberBookings.length} prior bookings, ${communications.length} communications, ${allDetectedIssues.length} prior issues for member`);

    return {
      context: contextLines.join('\n'),
      factors,
    };
  } catch (error) {
    console.error('[History] Error fetching member history:', error);
    return { context: '', factors: {} };
  }
}

// Default prompts
const DEFAULT_EXTRACTION_PROMPT = `You are a qualitative research analyst processing a transcribed move-out interview between a PadSplit agent and a former member. The transcript is from automated speech-to-text — expect false starts, crosstalk, filler words, tangents, and garbled text. Focus on substance.

Respond with ONLY the JSON object below. No preamble, no markdown, no explanation.

{
  "member_name": "string or null",
  "member_id": "string or null",
  "agent_name": "string or null",
  "length_of_stay": "string or null",
  "phone_number": "string or null",
  "primary_reason_stated": "The member's own explanation of why they left, condensed to 1-3 sentences using their framing and language.",
  "primary_reason_interpreted": "If you believe the stated reason may not be the full picture, explain why based on EVIDENCE from the transcript. If there is no contradicting evidence, set this to null.",
  "trigger_type": "gradual | single_event | external_life_change | compound",
  "trigger_description": "What specifically happened or changed",
  "issues_mentioned": [
    {
      "issue": "Short clear description",
      "category": "maintenance | host_behavior | roommate_conflict | payment_difficulty | employment | safety | cleanliness | communication | policy_confusion | transfer_friction | life_change | other",
      "severity_expressed": "low | medium | high | critical",
      "mention_count": 1,
      "evidence_strength": "strong | moderate | weak",
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
- Do NOT assume hidden motivations. Only flag an interpreted reason when the transcript contains concrete contradicting evidence.
- For mention_count, count the number of DISTINCT times the member referenced this issue (not the agent).
- Mark evidence_strength as 'weak' for issues mentioned only once, casually, or only raised by the agent. Mark 'moderate' for issues discussed at length or with emotion. Mark 'strong' ONLY when the member explicitly connects the issue to their decision to leave.
- For blind_spots, be thorough — look for silent suffering, assumptions about PadSplit's limitations, information gaps.
- For quotes, use EXACT words from the transcript.
- When ambiguous, use confidence_flags rather than presenting interpretation as fact.`;

const DEFAULT_CLASSIFICATION_PROMPT = `You are a housing operations analyst at PadSplit. You are receiving structured extraction data from a member move-out interview, the original transcript for verification, AND factual member history from PadSplit's system data. Cross-reference ALL sources.

Input: the JSON extraction from the previous processing step, followed by the original transcript for verification, followed by member history data from the system.

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
  "preventability_rationale": "2-3 sentences explaining how system data influenced this score",
  "preventability_data_factors": {
    "prior_bookings_count": 0,
    "communications_sent": 0,
    "known_issues_before_departure": [],
    "issue_was_previously_reported": false,
    "time_as_member_days": 0,
    "score_adjustment": "description of how system data raised or lowered the score"
  },
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
2. Only use issues with evidence_strength 'strong' or 'moderate' when determining the primary_reason_code. Issues with 'weak' evidence should only appear in secondary_reason_codes.
3. If the extraction's primary_reason_interpreted contradicts what the member actually said in the transcript, override it using the transcript as ground truth.
4. Lower the preventability_score by 2 points if the primary reason is based on interpretation rather than explicit member statements.
5. PREVENTABILITY SCORING: 9-10: Clear signals, tools to intervene, failed to act. 7-8: Possible with proactive changes. 5-6: Partially preventable. 3-4: Mostly external. 1-2: Fully external.

DATA-DRIVEN PREVENTABILITY ADJUSTMENTS (use the MEMBER HISTORY section):
6. If the member's issue was ALREADY KNOWN in the system (appears in prior detected_issues or communications) but was NOT resolved → INCREASE preventability_score by +2 (missed opportunity to act on known signal).
7. If communications were sent addressing the issue but the member still left → INCREASE preventability_score by +1 (action was taken but insufficient).
8. If NO communications were ever sent to the member and the issue was reportable → INCREASE preventability_score by +1 (no outreach attempted).
9. If the member had multiple prior bookings (3+) → INCREASE regrettability to "High" (engaged, loyal member lost).
10. If the member tenure exceeds 180 days → this is a long-term member; weight their departure more heavily in preventability.
11. If NO prior system touchpoints exist for this issue (not in detected_issues, no communications) → DECREASE preventability_score by -1 (system had no visibility).
12. Always populate preventability_data_factors with the actual system data that influenced your scoring. The score_adjustment field must explain what changed and why.
13. If no member history data is available, score purely on transcript evidence and note "No system history available" in score_adjustment.

REGRETTABILITY:
14. High = engaged member we should have kept. Low = departure was inevitable or acceptable.
15. FLAG FOR HUMAN REVIEW when: transcript is ambiguous, contradictory, involves legal issues, or uncertain between primary codes.`;

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
      .select('has_valid_conversation, contact_phone, contact_email, member_name')
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

    const extractionPrompt = prompts?.find((p: any) => p.prompt_key === 'extraction');
    const classificationPrompt = prompts?.find((p: any) => p.prompt_key === 'classification');

    const extractionSystemPrompt = extractionPrompt?.prompt_text || DEFAULT_EXTRACTION_PROMPT;
    const extractionModel = extractionPrompt?.model || 'google/gemini-2.5-flash';
    const extractionTemp = Number(extractionPrompt?.temperature) || 0.2;

    const classificationSystemPrompt = classificationPrompt?.prompt_text || DEFAULT_CLASSIFICATION_PROMPT;
    const classificationModel = classificationPrompt?.model || 'google/gemini-2.5-pro';
    const classificationTemp = Number(classificationPrompt?.temperature) || 0.2;

    // === PROMPT A: Extraction ===
    console.log(`[Research] Running Prompt A (extraction) for ${bookingId}`);
    const extractionResult = await callLovableAI(
      lovableApiKey,
      extractionModel,
      extractionTemp,
      extractionSystemPrompt,
      `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
    );

    const extraction = await parseJsonWithRetry(
      extractionResult.content,
      lovableApiKey,
      extractionModel,
      extractionTemp,
      extractionSystemPrompt,
      `Here is the transcript to analyze:\n\n${transcription.call_transcription}`
    );

    console.log(`[Research] Prompt A complete. Issues found: ${extraction.issues_mentioned?.length || 0}`);

    // Log cost for Prompt A
    await logApiCost(supabase, {
      service_provider: 'lovable_ai',
      service_type: 'research_extraction',
      edge_function: 'process-research-record',
      booking_id: bookingId,
      input_tokens: extractionResult.inputTokens,
      output_tokens: extractionResult.outputTokens,
      metadata: { model: extractionModel, prompt: 'A' },
      is_internal: false,
    });

    // === MEMBER HISTORY LOOKUP (between Prompt A and Prompt B) ===
    console.log(`[Research] Fetching member history for ${bookingId}`);
    const memberHistory = await fetchMemberHistory(supabase, bookingId, extraction);

    // === PROMPT B: Classification (with member history context) ===
    console.log(`[Research] Running Prompt B (classification) for ${bookingId}`);

    let promptBUserMessage = `Here is the structured extraction to classify:\n\n${JSON.stringify(extraction, null, 2)}\n\n--- ORIGINAL TRANSCRIPT FOR VERIFICATION ---\n\n${transcription.call_transcription}`;

    if (memberHistory.context) {
      promptBUserMessage += `\n\n--- MEMBER HISTORY (SYSTEM DATA) ---\n\n${memberHistory.context}`;
    } else {
      promptBUserMessage += `\n\n--- MEMBER HISTORY (SYSTEM DATA) ---\n\nNo prior system data found for this member. Score preventability based on transcript evidence only.`;
    }

    const classificationResult = await callLovableAI(
      lovableApiKey,
      classificationModel,
      classificationTemp,
      classificationSystemPrompt,
      promptBUserMessage
    );

    const classification = await parseJsonWithRetry(
      classificationResult.content,
      lovableApiKey,
      classificationModel,
      classificationTemp,
      classificationSystemPrompt,
      promptBUserMessage
    );

    console.log(`[Research] Prompt B complete. Primary code: ${classification.primary_reason_code}, Preventability: ${classification.preventability_score}`);

    // Inject system-level factors if the AI didn't populate them
    if (!classification.preventability_data_factors || Object.keys(classification.preventability_data_factors).length === 0) {
      classification.preventability_data_factors = memberHistory.factors;
    }

    // Log cost for Prompt B
    await logApiCost(supabase, {
      service_provider: 'lovable_ai',
      service_type: 'research_classification',
      edge_function: 'process-research-record',
      booking_id: bookingId,
      input_tokens: classificationResult.inputTokens,
      output_tokens: classificationResult.outputTokens,
      metadata: { model: classificationModel, prompt: 'B' },
      is_internal: false,
    });

    // Store results
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
        preventabilityDataFactors: classification.preventability_data_factors,
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
