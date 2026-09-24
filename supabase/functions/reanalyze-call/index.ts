import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { requireUserOrInternal, canSeeBooking, jsonResponse, corsHeaders, MANAGERS } from "../_shared/auth.ts";
import { logApiCost, tokensFromUsage } from "../_shared/costs.ts";

// Types for call type configuration
interface CallTypeConfig {
  callType: {
    name: string;
    analysis_focus: string | null;
    scoring_criteria: Record<string, number> | null;
  } | null;
  knowledge: Array<{
    title: string;
    content: string;
    category: string;
  }>;
  rules: Array<{
    rule_name: string;
    rule_type: string;
    rule_description: string | null;
    ai_instruction: string | null;
    weight: number;
  }>;
  script: {
    name: string;
    script_content: string;
  } | null;
}

// Model selection threshold (5 minutes = 300 seconds)
const ANALYSIS_MODEL_THRESHOLD_SECONDS = 300;

// Select AI model based on call duration for cost optimization
function selectAnalysisModel(callDurationSeconds: number | null): string {
  if (!callDurationSeconds || callDurationSeconds < ANALYSIS_MODEL_THRESHOLD_SECONDS) {
    console.log(`[Model] Using Flash for ${callDurationSeconds || 0}s call (< 5 min threshold)`);
    return 'google/gemini-2.5-flash';
  }
  
  console.log(`[Model] Using Pro for ${callDurationSeconds}s call (≥ 5 min threshold)`);
  return 'google/gemini-2.5-pro';
}

// LLM Provider types for hybrid selection
type LLMProviderName = 'lovable_ai' | 'deepseek';

interface LLMProviderSelection {
  provider: LLMProviderName;
  model: string;
  fallbackReason?: string;
}

// Fetch provider-specific prompt enhancements from database
async function getProviderPromptEnhancements(
  supabase: any, 
  providerName: 'deepseek' | 'lovable_ai'
): Promise<string> {
  try {
    const { data: enhancements, error } = await supabase
      .from('llm_prompt_enhancements')
      .select('content')
      .eq('provider_name', providerName)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error || !enhancements || enhancements.length === 0) {
      console.log(`[LLM Enhance] No active enhancements for ${providerName}`);
      return '';
    }

    const combinedEnhancements = enhancements.map((e: any) => e.content).join('\n\n');
    console.log(`[LLM Enhance] Loaded ${enhancements.length} enhancements for ${providerName} (${combinedEnhancements.length} chars)`);
    return combinedEnhancements;
  } catch (error) {
    console.error('[LLM Enhance] Error fetching enhancements:', error);
    return '';
  }
}

// Select LLM provider based on weights and fallback conditions
async function selectLLMProvider(
  supabase: any,
  bookingStatus: string | null,
  callDurationSeconds: number | null
): Promise<LLMProviderSelection> {
  try {
    // Fetch LLM provider settings
    const { data: settings, error } = await supabase
      .from('llm_provider_settings')
      .select('provider_name, weight, api_config')
      .eq('is_active', true);

    if (error) {
      console.log('[LLM A/B] Error fetching settings, defaulting to Gemini:', error);
      return { provider: 'lovable_ai', model: selectAnalysisModel(callDurationSeconds) };
    }

    const deepseekSettings = settings?.find((s: any) => s.provider_name === 'deepseek');
    const geminiSettings = settings?.find((s: any) => s.provider_name === 'lovable_ai');

    const deepseekWeight = deepseekSettings?.weight ?? 0;
    const geminiWeight = geminiSettings?.weight ?? 100;

    // Check fallback conditions from DeepSeek's api_config
    const fallbackConditions: string[] = deepseekSettings?.api_config?.use_gemini_fallback_for || [];
    const isNonBooking = bookingStatus === 'Non Booking';

    // If DeepSeek has weight but this is a non-booking call, use Gemini fallback
    if (isNonBooking && fallbackConditions.includes('non_booking') && deepseekWeight > 0) {
      console.log('[LLM A/B] Non-booking call detected, falling back to Gemini for quality');
      return {
        provider: 'lovable_ai',
        model: selectAnalysisModel(callDurationSeconds),
        fallbackReason: 'non_booking'
      };
    }

    // Weight-based selection
    const totalWeight = deepseekWeight + geminiWeight;
    if (totalWeight === 0 || deepseekWeight === 0) {
      console.log('[LLM A/B] DeepSeek weight is 0, using Gemini');
      return { provider: 'lovable_ai', model: selectAnalysisModel(callDurationSeconds) };
    }

    if (geminiWeight === 0) {
      console.log('[LLM A/B] Gemini weight is 0, using DeepSeek');
      return { provider: 'deepseek', model: 'deepseek-v4-flash' };
    }

    // Random selection based on weights
    const random = Math.random() * totalWeight;
    if (random < deepseekWeight) {
      console.log(`[LLM A/B] Selected DeepSeek (weight: ${deepseekWeight}/${totalWeight})`);
      return { provider: 'deepseek', model: 'deepseek-v4-flash' };
    }

    console.log(`[LLM A/B] Selected Gemini (weight: ${geminiWeight}/${totalWeight})`);
    return { provider: 'lovable_ai', model: selectAnalysisModel(callDurationSeconds) };
  } catch (error) {
    console.error('[LLM A/B] Error selecting provider:', error);
    return { provider: 'lovable_ai', model: selectAnalysisModel(callDurationSeconds) };
  }
}

// Call DeepSeek API for analysis
async function callDeepSeekForAnalysis(
  systemPrompt: string,
  userPrompt: string
): Promise<{
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}> {
  const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');

  const startTime = Date.now();
  
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      stream: false,
    }),
  });

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || '';
  const inputTokens = result.usage?.prompt_tokens || Math.ceil(userPrompt.length / 4);
  const outputTokens = result.usage?.completion_tokens || Math.ceil(content.length / 4);

  console.log(`[DeepSeek] Response received: ${inputTokens} input, ${outputTokens} output, ${latencyMs}ms`);

  return {
    content,
    model: result.model || 'deepseek-v4-flash',
    inputTokens,
    outputTokens,
    latencyMs,
  };
}


// Fetch call type configuration from database
async function fetchCallTypeConfig(
  supabase: any,
  callTypeId: string | null
): Promise<CallTypeConfig | null> {
  if (!callTypeId) {
    console.log('[Config] No call_type_id provided, using default prompt');
    return null;
  }

  try {
    const { data: callType, error: callTypeError } = await supabase
      .from('call_types')
      .select('name, analysis_focus, scoring_criteria')
      .eq('id', callTypeId)
      .eq('is_active', true)
      .maybeSingle();

    if (callTypeError || !callType) {
      console.log('[Config] Call type not found or inactive:', callTypeId);
      return null;
    }

    const { data: knowledge, error: knowledgeError } = await supabase
      .from('company_knowledge')
      .select('title, content, category')
      .eq('is_active', true)
      .or(`call_type_ids.is.null,call_type_ids.cs.{${callTypeId}}`)
      .order('priority', { ascending: false });

    if (knowledgeError) {
      console.log('[Config] Error fetching knowledge:', knowledgeError);
    }

    const { data: rules, error: rulesError } = await supabase
      .from('call_type_rules')
      .select('rule_name, rule_type, rule_description, ai_instruction, weight')
      .eq('call_type_id', callTypeId)
      .eq('is_active', true)
      .order('weight', { ascending: false });

    if (rulesError) {
      console.log('[Config] Error fetching rules:', rulesError);
    }

    const { data: script, error: scriptError } = await supabase
      .from('script_templates')
      .select('name, script_content')
      .eq('call_type_id', callTypeId)
      .eq('is_active', true)
      .maybeSingle();

    if (scriptError) {
      console.log('[Config] Error fetching script:', scriptError);
    }

    console.log(`[Config] Loaded config for call type "${callType.name}":`, {
      hasAnalysisFocus: !!callType.analysis_focus,
      knowledgeCount: knowledge?.length || 0,
      rulesCount: rules?.length || 0,
      hasScript: !!script
    });

    return {
      callType,
      knowledge: knowledge || [],
      rules: rules || [],
      script: script || null
    };
  } catch (error) {
    console.error('[Config] Error fetching call type config:', error);
    return null;
  }
}

// Build dynamic analysis prompt based on configuration
// Global company knowledge (call_type_ids IS NULL), used when the booking has no call type
async function fetchGlobalKnowledge(
  supabase: any
): Promise<Array<{ title: string; content: string; category: string }>> {
  try {
    const { data, error } = await supabase
      .from('company_knowledge')
      .select('title, content, category')
      .eq('is_active', true)
      .is('call_type_ids', null)
      .order('priority', { ascending: false });
    if (error) {
      console.log('[Config] Error fetching global knowledge:', error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

function buildDynamicAnalysisPrompt(
  transcription: string,
  config: CallTypeConfig | null,
  isNonBooking: boolean = false,
  globalKnowledge: Array<{ title: string; content: string; category: string }> = []
): string {
  if (!config) {
    return buildDefaultAnalysisPrompt(transcription, isNonBooking, globalKnowledge);
  }

  const sections: string[] = [];

  sections.push(`You are an expert at analyzing sales call transcriptions for PadSplit, a housing/rental service.
This is a "${config.callType?.name || 'General'}" call type.`);

  if (config.callType?.analysis_focus) {
    sections.push(`
ANALYSIS FOCUS:
${config.callType.analysis_focus}`);
  }

  if (config.knowledge.length > 0) {
    sections.push(`
COMPANY KNOWLEDGE (use this context when analyzing):
${config.knowledge.map(k => `
[${k.category.toUpperCase()}] ${k.title}:
${k.content}`).join('\n')}`);
  }

  const requiredRules = config.rules.filter(r => r.rule_type === 'required');
  const recommendedRules = config.rules.filter(r => r.rule_type === 'recommended');
  const prohibitedRules = config.rules.filter(r => r.rule_type === 'prohibited');

  if (requiredRules.length > 0 || recommendedRules.length > 0 || prohibitedRules.length > 0) {
    sections.push(`
EVALUATION CRITERIA:`);

    if (requiredRules.length > 0) {
      sections.push(`
REQUIRED (agent MUST do these - mark as improvement if missing):
${requiredRules.map(r => `- ${r.rule_name}: ${r.ai_instruction || r.rule_description || ''}`).join('\n')}`);
    }

    if (recommendedRules.length > 0) {
      sections.push(`
RECOMMENDED (positive if done, note if missing):
${recommendedRules.map(r => `- ${r.rule_name}: ${r.ai_instruction || r.rule_description || ''}`).join('\n')}`);
    }

    if (prohibitedRules.length > 0) {
      sections.push(`
PROHIBITED (flag as issue if detected):
${prohibitedRules.map(r => `- ${r.rule_name}: ${r.ai_instruction || r.rule_description || ''}`).join('\n')}`);
    }
  }

  if (config.script) {
    sections.push(`
SCRIPT TEMPLATE (evaluate adherence):
Script: "${config.script.name}"
${config.script.script_content}

Note: Agent should follow the general structure and key talking points. Minor deviations are acceptable if the conversation flows naturally.`);
  }

  sections.push(`
CRITICAL INSTRUCTIONS:
1. Extract ALL relevant information, even minor mentions
2. If the call is short or limited, still extract what you can
3. NEVER return empty arrays if there's ANY relevant content
4. For short calls (under 2 minutes), adapt your analysis to the available content
5. Be specific - quote or paraphrase actual phrases from the call when possible
6. Evaluate against the EVALUATION CRITERIA above when generating feedback

TRANSCRIPTION:
${transcription}`);

  const scoringGuide = config.callType?.scoring_criteria 
    ? `CUSTOM SCORING WEIGHTS:
${Object.entries(config.callType.scoring_criteria).map(([key, weight]) => `- ${key}: weight ${weight}`).join('\n')}`
    : `SCORING GUIDE (1-10):
- 9-10: Exceptional, textbook execution
- 7-8: Good, minor improvements possible  
- 5-6: Average, noticeable gaps
- 3-4: Below average, significant issues
- 1-2: Poor, major problems`;

  sections.push(`
Return a JSON object with EXACTLY this structure (no markdown, just raw JSON):
{
  "summary": "A concise 2-3 sentence summary capturing the key points of this call. What was discussed? What was the outcome?",
  "memberDetails": {
    "firstName": "string or null - the member's first name if mentioned",
    "lastName": "string or null - the member's last name if mentioned",
    "phoneNumber": "string or null - phone number if mentioned or confirmed (format: xxx-xxx-xxxx)",
    "email": "string or null - email address if mentioned",
    "householdSize": "number or null - how many people will be moving in",
    "weeklyBudget": "number or null - their weekly budget amount in dollars",
    "moveInDate": "string or null - specific move-in date mentioned (e.g., 'December 15' or 'next Monday')",
    "commitmentWeeks": "number or null - how many weeks they plan to stay",
    "preferredPaymentMethod": "string or null - cash, card, etc.",
    "propertyAddress": "string or null - specific property address or listing being discussed"
  },
  "memberConcerns": ["List every concern, worry, hesitation, or question raised by the member"],
  "memberPreferences": ["List ALL preferences mentioned: location, budget, timing, room type, amenities, etc."],
  "recommendedActions": ["Specific follow-up actions for the agent"],
  "objections": ["Any hesitations, pushback, or reasons the member gave for not committing"],
  "moveInReadiness": "high | medium | low",
  "callSentiment": "positive | neutral | negative"${isNonBooking ? `,
  "buyerIntent": {
    "score": 65,
    "intentLevel": "hot (75-100: high conversion potential) | warm (40-74: interested but needs nurturing) | cold (0-39: low immediate potential)",
    "positiveSignals": ["List signals indicating buying intent: specific move-in date, budget confirmed, asked about booking process, decision maker, detailed questions"],
    "negativeSignals": ["List signals reducing intent: 'just looking', price objections, needs to ask others, comparison shopping, no timeline"],
    "decisionMaker": true,
    "timeframe": "immediate (moving ASAP) | this_week | this_month | exploring (just researching)"
  }` : ''},
  "agentFeedback": {
    "overallRating": "excellent | good | needs_improvement | poor",
    "strengths": ["Specific things the agent did well, especially related to the evaluation criteria"],
    "improvements": ["Areas to improve, especially missed required criteria or prohibited behaviors"],
    "coachingTips": ["Actionable tips based on the evaluation criteria"],
    "scores": {
      "communication": 7,
      "productKnowledge": 7,
      "objectionHandling": 7,
      "closingSkills": 7
    }
  },
  "lifestyleSignals": [
    {
      "category": "healthcare | pet | transportation | home_services | telephony | employment | financial | moving",
      "signal": "Exact quote or paraphrase from the conversation indicating a lifestyle need or opportunity",
      "confidence": "high (explicitly stated) | medium (strongly implied) | low (loosely inferred)",
      "opportunity": "Brief description of the cross-sell/upsell opportunity"
    }
  ]
}

LIFESTYLE SIGNALS EXTRACTION GUIDE:
- healthcare: mentions of no insurance, needing coverage, ACA/Obamacare, medical needs, uninsured
- pet: mentions of dogs, cats, pets, pet-friendly, pet deposits, animal needs
- transportation: car details, no car, rideshare (Uber/Lyft), bus, transit needs
- home_services: furniture needs, cleaning, WiFi/internet, laundry, appliances, bedding
- telephony: phone plan issues, no phone service, prepaid phone, WiFi calling needs
- employment: job searching, work schedule, unemployment, gig work, "not working"
- financial: payment difficulties, no bank account, credit issues, cash-only, payday loans
- moving: moving help, storage needs, shipping belongings, U-Haul, packing
Only include signals with genuine evidence from the conversation. Return an empty array if no lifestyle signals are detected.

${scoringGuide}${isNonBooking ? `

BUYER INTENT SCORING GUIDE (0-100):
Calculate the buyerIntent.score by adding/subtracting these weights:
+20: Specific move-in date within 7 days
+15: Budget confirmed and within PadSplit range ($150-$250/week)
+15: Asked about booking/move-in process or deposits
+10: Single decision maker confirmed
+10: First-time caller with specific property interest
+5:  Positive call sentiment
+5:  Asked follow-up questions
-10: "Just looking" or "researching for someone else"
-15: Price objections unresolved at call end
-15: Decision maker absent ("need to ask my wife/husband")
-10: Comparison shopping explicitly mentioned
-10: No specific timeline mentioned
-5:  Negative call sentiment

Start at 50 as baseline. Final score should be 0-100.
intentLevel: "hot" (75-100), "warm" (40-74), "cold" (0-39)` : ''}

IMPORTANT: Even for very short calls, provide meaningful analysis. Reference the evaluation criteria in your feedback.`);

  return sections.join('\n');
}

function buildDefaultAnalysisPrompt(
  transcription: string,
  isNonBooking: boolean = false,
  globalKnowledge: Array<{ title: string; content: string; category: string }> = []
): string {
  const base = `You are an expert at analyzing sales call transcriptions for PadSplit, a housing/rental service.

CRITICAL INSTRUCTIONS:
1. Extract ALL relevant information, even minor mentions
2. If the call is short or limited, still extract what you can
3. NEVER return empty arrays if there's ANY relevant content
4. For short calls (under 2 minutes), adapt your analysis to the available content
5. Be specific - quote or paraphrase actual phrases from the call when possible

TRANSCRIPTION:
${transcription}

Return a JSON object with EXACTLY this structure (no markdown, just raw JSON):
{
  "summary": "A concise 2-3 sentence summary capturing the key points of this call. What was discussed? What was the outcome?",
  "memberDetails": {
    "firstName": "string or null - the member's first name if mentioned",
    "lastName": "string or null - the member's last name if mentioned",
    "phoneNumber": "string or null - phone number if mentioned or confirmed (format: xxx-xxx-xxxx)",
    "email": "string or null - email address if mentioned",
    "householdSize": "number or null - how many people will be moving in",
    "weeklyBudget": "number or null - their weekly budget amount in dollars",
    "moveInDate": "string or null - specific move-in date mentioned (e.g., 'December 15' or 'next Monday')",
    "commitmentWeeks": "number or null - how many weeks they plan to stay",
    "preferredPaymentMethod": "string or null - cash, card, etc.",
    "propertyAddress": "string or null - specific property address or listing being discussed"
  },
  "memberConcerns": ["List every concern, worry, hesitation, or question raised by the member, even minor ones. Example: 'Worried about parking availability', 'Concerned about noise levels'"],
  "memberPreferences": ["List ALL preferences mentioned: location, budget, timing, room type, amenities, etc. Example: 'Prefers ground floor', 'Budget under $800', 'Needs to move by next week'"],
  "recommendedActions": ["Specific follow-up actions for the agent. Example: 'Send listing links for downtown properties', 'Follow up about move-in date confirmation', 'Schedule property tour'"],
  "objections": ["Any hesitations, pushback, or reasons the member gave for not committing. Example: 'Wants to see other options first', 'Price is higher than expected'"],
  "moveInReadiness": "high (ready to move within days, very motivated) | medium (interested but exploring options, flexible timeline) | low (just researching, no urgency)",
  "callSentiment": "positive (member engaged, interested, good rapport) | neutral (standard business conversation) | negative (frustrated, disengaged, complaints)"${isNonBooking ? `,
  "buyerIntent": {
    "score": 65,
    "intentLevel": "hot (75-100: high conversion potential) | warm (40-74: interested but needs nurturing) | cold (0-39: low immediate potential)",
    "positiveSignals": ["List signals indicating buying intent: specific move-in date, budget confirmed, asked about booking process, decision maker, detailed questions about properties"],
    "negativeSignals": ["List signals reducing intent: 'just looking', unresolved price objections, needs to ask spouse/others, comparison shopping, no specific timeline"],
    "decisionMaker": true,
    "timeframe": "immediate (moving ASAP/within days) | this_week | this_month | exploring (just researching)"
  }` : ''},
  "agentFeedback": {
    "overallRating": "excellent (exceeded expectations) | good (solid performance) | needs_improvement (missed opportunities) | poor (significant issues)",
    "strengths": ["Specific things the agent did well. Quote exact moments when possible. Example: 'Great rapport building when discussing the member's job situation', 'Clearly explained the booking process'"],
    "improvements": ["Specific areas to improve with examples. Example: 'Could have asked more qualifying questions about budget', 'Missed opportunity to address timeline concerns'"],
    "coachingTips": ["Actionable tips. Example: 'Try using open-ended questions to uncover more preferences', 'When member mentions concerns, acknowledge them before moving on'"],
    "scores": {
      "communication": 7,
      "productKnowledge": 7,
      "objectionHandling": 7,
      "closingSkills": 7
    }
  },
  "lifestyleSignals": [
    {
      "category": "healthcare | pet | transportation | home_services | telephony | employment | financial | moving",
      "signal": "Exact quote or paraphrase from the conversation indicating a lifestyle need or opportunity",
      "confidence": "high (explicitly stated) | medium (strongly implied) | low (loosely inferred)",
      "opportunity": "Brief description of the cross-sell/upsell opportunity"
    }
  ]
}

LIFESTYLE SIGNALS EXTRACTION GUIDE:
- healthcare: mentions of no insurance, needing coverage, ACA/Obamacare, medical needs, uninsured
- pet: mentions of dogs, cats, pets, pet-friendly, pet deposits, animal needs
- transportation: car details, no car, rideshare (Uber/Lyft), bus, transit needs
- home_services: furniture needs, cleaning, WiFi/internet, laundry, appliances, bedding
- telephony: phone plan issues, no phone service, prepaid phone, WiFi calling needs
- employment: job searching, work schedule, unemployment, gig work, "not working"
- financial: payment difficulties, no bank account, credit issues, cash-only, payday loans
- moving: moving help, storage needs, shipping belongings, U-Haul, packing
Only include signals with genuine evidence from the conversation. Return an empty array if no lifestyle signals are detected.

SCORING GUIDE (1-10):
- 9-10: Exceptional, textbook execution
- 7-8: Good, minor improvements possible  
- 5-6: Average, noticeable gaps
- 3-4: Below average, significant issues
- 1-2: Poor, major problems${isNonBooking ? `

BUYER INTENT SCORING GUIDE (0-100):
Calculate the buyerIntent.score by adding/subtracting these weights:
+20: Specific move-in date within 7 days
+15: Budget confirmed and within PadSplit range ($150-$250/week)
+15: Asked about booking/move-in process or deposits
+10: Single decision maker confirmed
+10: First-time caller with specific property interest
+5:  Positive call sentiment
+5:  Asked follow-up questions
-10: "Just looking" or "researching for someone else"
-15: Price objections unresolved at call end
-15: Decision maker absent ("need to ask my wife/husband")
-10: Comparison shopping explicitly mentioned
-10: No specific timeline mentioned
-5:  Negative call sentiment

Start at 50 as baseline. Final score should be 0-100.
intentLevel: "hot" (75-100), "warm" (40-74), "cold" (0-39)` : ''}

IMPORTANT: Even for very short calls, provide meaningful analysis. A 1-minute call checking availability still has extractable insights (member's location interest, timing, urgency level).`;
  if (globalKnowledge.length === 0) return base;
  return base + `

Company knowledge (use this context when analyzing):
${globalKnowledge.map(k => `
[${(k.category || 'general').toUpperCase()}] ${k.title}:
${k.content}`).join('\n')}`;
}

// Retry logic for AI calls with hybrid LLM selection
async function callAIWithRetry(
  supabase: any,
  lovableApiKey: string, 
  transcription: string,
  config: CallTypeConfig | null,
  bookingId: string,
  agentId: string | null,
  siteId: string | null,
  maxRetries = 2,
  callDurationSeconds: number | null = null,
  bookingStatus: string | null = null,
  triggeredByUserId: string | null = null,
  isInternal: boolean = false
): Promise<{ keyPoints: any; agentFeedback: any; summary: string; llmProvider: LLMProviderName }> {
  let lastError: Error | null = null;
  
  // Hybrid LLM selection: choose provider based on weights and fallback conditions
  const llmSelection = await selectLLMProvider(supabase, bookingStatus, callDurationSeconds);
  const isNonBooking = bookingStatus === 'Non Booking';
  const globalKnowledge = config ? [] : await fetchGlobalKnowledge(supabase);
  console.log(`[ReAnalyze] Using LLM provider: ${llmSelection.provider} (model: ${llmSelection.model}${llmSelection.fallbackReason ? `, fallback: ${llmSelection.fallbackReason}` : ''})`);
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ReAnalyze] AI attempt ${attempt + 1}/${maxRetries + 1}`);
      
      const prompt = buildDynamicAnalysisPrompt(transcription, config, isNonBooking, globalKnowledge);
      let providerUsed: LLMProviderName = llmSelection.provider;
      
      let aiContent = '';
      let inputTokens = 0;
      let outputTokens = 0;

      const runGemini = async (geminiModel: string, geminiFallbackReason?: string) => {
        // Use Gemini (Lovable AI) for analysis
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: geminiModel,
            messages: [
              { role: 'user', content: prompt }
            ],
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
        }

        const aiResult = await aiResponse.json();
        aiContent = aiResult.choices?.[0]?.message?.content || '';
        inputTokens = Math.ceil(prompt.length / 4);
        outputTokens = Math.ceil(aiContent.length / 4);
        
        // Log Lovable AI cost
        if (attempt === 0 || attempt === maxRetries) {
          await logApiCost(supabase, {
            service_provider: 'lovable_ai',
            service_type: 'ai_reanalysis',
            edge_function: 'reanalyze-call',
            booking_id: bookingId,
            agent_id: agentId || undefined,
            site_id: siteId || undefined,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            metadata: { 
              model: geminiModel, 
              attempt: attempt + 1, 
              call_duration_seconds: callDurationSeconds,
              fallback_reason: geminiFallbackReason
            },
            triggered_by_user_id: triggeredByUserId || undefined,
            is_internal: isInternal,
          });
        }
            };

      const parseContent = (content: string) => {
        let c = content.trim();
        if (c.startsWith('```json')) c = c.slice(7);
        if (c.startsWith('```')) c = c.slice(3);
        if (c.endsWith('```')) c = c.slice(0, -3);
        return JSON.parse(c.trim());
      };

      let parsed: any;
      if (llmSelection.provider === 'deepseek') {
        try {
        // Use DeepSeek for analysis with provider-specific prompt enhancements
        let systemPrompt = 'You are an expert at analyzing sales call transcriptions. Always respond with valid JSON only, no markdown.';
        
        // Fetch and inject provider-specific enhancements for improved readiness detection
        const enhancements = await getProviderPromptEnhancements(supabase, 'deepseek');
        if (enhancements) {
          systemPrompt = enhancements + '\n\n' + systemPrompt;
          console.log('[ReAnalyze] DeepSeek prompt enhanced with few-shot examples and scoring rules');
        }
        
        const deepseekResult = await callDeepSeekForAnalysis(systemPrompt, prompt);
        aiContent = deepseekResult.content;
        inputTokens = deepseekResult.inputTokens;
        outputTokens = deepseekResult.outputTokens;

        // Log DeepSeek cost
        if (attempt === 0 || attempt === maxRetries) {
          await logApiCost(supabase, {
            service_provider: 'deepseek',
            service_type: 'ai_reanalysis',
            edge_function: 'reanalyze-call',
            booking_id: bookingId,
            agent_id: agentId || undefined,
            site_id: siteId || undefined,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            metadata: { 
              model: deepseekResult.model, 
              attempt: attempt + 1, 
              call_duration_seconds: callDurationSeconds,
              latency_ms: deepseekResult.latencyMs,
              fallback_reason: llmSelection.fallbackReason,
              prompt_enhanced: !!enhancements
            },
            triggered_by_user_id: triggeredByUserId || undefined,
            is_internal: isInternal,
          });
        }
          parsed = parseContent(aiContent);
        } catch (dsErr) {
          console.error('[LLM] DeepSeek failed, falling back to Gemini:', dsErr instanceof Error ? dsErr.message : 'unknown');
          providerUsed = 'lovable_ai';
          aiContent = '';
          await runGemini(selectAnalysisModel(callDurationSeconds), 'deepseek_error');
          parsed = parseContent(aiContent);
        }
      } else {
        await runGemini(llmSelection.model, llmSelection.fallbackReason);
        parsed = parseContent(aiContent);
      }

      
      // Validate the response has meaningful content
      const summary = parsed.summary || '';
      if (summary.length < 20 || summary.includes('parsing failed')) {
        throw new Error('AI returned insufficient summary');
      }
      
      const agentFeedback = parsed.agentFeedback || null;
      
      // Validate agent feedback has scores
      if (agentFeedback && (!agentFeedback.scores || typeof agentFeedback.scores.communication !== 'number')) {
        console.log('[ReAnalyze] Warning: Agent feedback missing scores, retrying...');
        if (attempt < maxRetries) {
          throw new Error('Agent feedback missing required scores');
        }
      }
      
      const keyPoints = {
        summary: parsed.summary,
        memberConcerns: parsed.memberConcerns || [],
        memberPreferences: parsed.memberPreferences || [],
        recommendedActions: parsed.recommendedActions || [],
        objections: parsed.objections || [],
        moveInReadiness: parsed.moveInReadiness || 'medium',
        callSentiment: parsed.callSentiment || 'neutral',
        memberDetails: parsed.memberDetails || null,
        // Lifestyle signals for cross-sell opportunities
        ...(parsed.lifestyleSignals && parsed.lifestyleSignals.length > 0 ? { lifestyleSignals: parsed.lifestyleSignals } : {}),
        // Only include buyerIntent for Non-Booking calls
        ...(isNonBooking && parsed.buyerIntent ? { buyerIntent: parsed.buyerIntent } : {}),
      };
      
      console.log('[ReAnalyze] AI parsing successful:', {
        summaryLength: summary.length,
        concerns: keyPoints.memberConcerns.length,
        preferences: keyPoints.memberPreferences.length,
        hasAgentFeedback: !!agentFeedback,
        llmProvider: providerUsed
      });
      
      return { keyPoints, agentFeedback, summary, llmProvider: providerUsed };
      
    } catch (error) {
      console.error(`[ReAnalyze] Attempt ${attempt + 1} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('AI analysis failed after retries');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUserOrInternal(req, MANAGERS);
  if (!auth.ok) return auth.response;

  try {
    const { bookingId } = await req.json();
    
    if (!bookingId) {
      throw new Error('Missing bookingId');
    }

    if (!(await canSeeBooking(auth.ctx, bookingId))) {
      return jsonResponse(404, { error: 'Booking not found' });
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Attribution from the verified caller
    const triggeredByUserId: string | null = auth.ctx.kind === 'user' ? auth.ctx.userId : null;
    const isInternal = auth.ctx.kind === 'user' && auth.ctx.role === 'super_admin';
    if (isInternal) console.log('[Internal] Request triggered by super_admin, marking costs as internal');
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    console.log(`[ReAnalyze] Starting re-analysis for booking ${bookingId}`);

    // Fetch the existing booking status, call_type_id, and agent info
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, transcription_status, call_duration_seconds, call_type_id, agent_id, status, record_type, agents(site_id)')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      throw new Error(`Booking not found: ${fetchError?.message || 'Unknown error'}`);
    }

    if (booking.transcription_status !== 'completed') {
      throw new Error('Transcription is not completed yet.');
    }

    const agentId = booking.agent_id || null;
    const siteId = (booking.agents as any)?.site_id || null;
    const bookingStatus = booking.status || null;

    // Fetch transcription from booking_transcriptions table
    const { data: transcriptionData, error: transcriptionError } = await supabase
      .from('booking_transcriptions')
      .select('call_transcription, call_key_points, qa_scores')
      .eq('booking_id', bookingId)
      .single();

    if (transcriptionError || !transcriptionData?.call_transcription) {
      throw new Error('No transcription found. Please transcribe the call first.');
    }

    console.log(`[ReAnalyze] Found transcription (${transcriptionData.call_transcription.length} chars, ${booking.call_duration_seconds}s duration, status: ${bookingStatus})`);

    // Fetch call type configuration if available
    const config = await fetchCallTypeConfig(supabase, booking.call_type_id);

    // Re-analyze with dynamic prompt, retry logic, and hybrid LLM selection
    const { keyPoints, agentFeedback, summary, llmProvider } = await callAIWithRetry(
      supabase,
      lovableApiKey,
      transcriptionData.call_transcription,
      config,
      bookingId,
      agentId,
      siteId,
      2, // maxRetries
      booking.call_duration_seconds, // Pass duration for model selection
      bookingStatus, // Pass status for LLM fallback logic
      triggeredByUserId,
      isInternal
    );

    // Preserve a previous buyerIntent for Non-Booking calls when the model omits it
    const previousBuyerIntent = (transcriptionData as any).call_key_points?.buyerIntent;
    if (bookingStatus === 'Non Booking' && keyPoints && !keyPoints.buyerIntent && previousBuyerIntent) {
      keyPoints.buyerIntent = previousBuyerIntent;
    }

    // Update booking_transcriptions with new analysis and LLM provider
    console.log(`[ReAnalyze] Updating booking_transcriptions with new analysis (provider: ${llmProvider})...`);
    const { error: updateError } = await supabase
      .from('booking_transcriptions')
      .update({
        call_summary: summary,
        call_key_points: keyPoints,
        agent_feedback: agentFeedback,
        llm_provider: llmProvider,
        updated_at: new Date().toISOString(),
      })
      .eq('booking_id', bookingId);

    if (updateError) {
      console.error('[ReAnalyze] Update error:', updateError);
      throw new Error(`Failed to update booking: ${updateError.message}`);
    }

    console.log(`[ReAnalyze] Successfully re-analyzed booking ${bookingId}`);

    // Score QA once if it has never been scored (non-research only). Non-fatal.
    if ((booking as any).record_type !== 'research' && (transcriptionData as any).qa_scores == null) {
      try {
        const qaRes = await fetch(`${supabaseUrl}/functions/v1/generate-qa-scores`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ bookingId }),
        });
        if (!qaRes.ok) {
          console.error(`[ReAnalyze] generate-qa-scores failed: ${qaRes.status}`);
        }
        await qaRes.body?.cancel().catch(() => {});
      } catch (qaErr) {
        console.error('[ReAnalyze] generate-qa-scores error:', qaErr instanceof Error ? qaErr.message : 'unknown');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Call re-analyzed successfully',
        bookingId,
        keyPoints,
        agentFeedback,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ReAnalyze] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
