import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 20;

const VALID_CODES = [
  'Host Negligence / Property Condition',
  'Payment Friction / Financial Hardship',
  'Roommate Conflict / Safety Concern',
  'Communication Breakdown / Support Dissatisfaction',
  'Policy Confusion / Lack of Flexibility',
  'External Life Event / Positive Move-On',
  'Data Error / Invalid Record',
];

const CLASSIFICATION_PROMPT = `You are classifying why a PadSplit member moved out based on a phone call transcript.

CLASSIFICATION RULES — MANDATORY:

Your job is to determine the TRUE reason this member left PadSplit. Do NOT simply trust what the member states upfront. Members often give polite or vague initial answers ("buying a home", "personal reasons") to avoid conflict, but the REAL reason emerges later in the conversation.

CLASSIFICATION PROCESS:
1. Read the FULL transcript, not just the first stated reason.
2. Look for what the member ACTUALLY complains about, gets emotional about, or spends the most time discussing.
3. If the stated reason is a positive life event ("buying a home", "relocating") BUT the transcript also reveals significant PadSplit-related problems (host issues, safety, payment disputes, bad conditions), classify based on the PadSplit problem — that's likely the real driver.
4. Only classify as External Life Event if the member genuinely has NO complaints about PadSplit throughout the ENTIRE conversation.

ALLOWED REASON CODES (you MUST pick exactly one):
1. "Host Negligence / Property Condition" — property issues, maintenance, mold, pests, dirty, uninhabitable, host unresponsive, misrepresentation, renovation issues, overcrowding
2. "Payment Friction / Financial Hardship" — can't afford, rent increase, rent too high, payment schedules, late fees, collections, billing, pricing, saving money
3. "Roommate Conflict / Safety Concern" — roommate issues, noise, cleanliness from roommates, harassment, drugs, theft, safety fears, assault
4. "Communication Breakdown / Support Dissatisfaction" — PadSplit support unresponsive, conflicting info, feeling unheard, process failures, app issues
5. "Policy Confusion / Lack of Flexibility" — transfer rules, guest policies, house rules, expectations vs reality, shared bathroom/kitchen objection
6. "External Life Event / Positive Move-On" — ONLY when member has NO PadSplit complaints in the entire transcript: buying home, job relocation, family, graduation, temporary housing, needed own space, incarceration, health, military, relationship change
7. "Data Error / Invalid Record" — member never moved in, wrong person contacted, identity theft, call too short (<30 words of actual conversation). Set human_review_recommended = true.

NEVER output "Other", "Unspecified", "Unknown", or "General". Every record MUST be classified into one of the 7 codes above.

If the transcript is ambiguous, pick the MOST LIKELY code based on the overall tone and content. If genuinely nothing can be determined from the transcript (e.g., member just says "okay" repeatedly), use "Data Error / Invalid Record".

Respond in JSON format:
{
  "primary_reason_code": "[one of the 7 codes above]",
  "reason_detail": "[specific sub-reason in 5-10 words]",
  "preventability_score": [1-10, where 1=not preventable, 10=easily preventable],
  "addressability": "Addressable" | "Partially Addressable" | "Not Addressable",
  "key_quotes": ["quote1", "quote2"],
  "case_summary": "[2-3 sentence summary of what happened]",
  "human_review_recommended": true/false,
  "stated_vs_actual_match": true/false,
  "stated_reason_summary": "[what member said upfront as their reason]",
  "actual_reason_summary": "[what the transcript actually reveals as the real reason]"
}`;

async function callLovableAI(
  apiKey: string,
  transcript: string
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: CLASSIFICATION_PROMPT },
        { role: 'user', content: `TRANSCRIPT:\n${transcript.substring(0, 10000)}` },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return {
    content: result.choices?.[0]?.message?.content || '',
    inputTokens: result.usage?.prompt_tokens || 0,
    outputTokens: result.usage?.completion_tokens || 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Build the valid codes list for the NOT IN filter
    // PostgREST doesn't support NOT IN on JSONB easily, so we fetch and filter client-side
    const { data: candidates, error: fetchError } = await supabase
      .from('booking_transcriptions')
      .select('id, call_transcription, research_classification')
      .eq('research_campaign_type', 'move_out_survey')
      .not('call_transcription', 'is', null)
      .not('research_classification', 'is', null)
      .limit(500);

    if (fetchError) throw fetchError;

    // Filter to records that need reclassification
    const needsReclass = (candidates || []).filter(r => {
      const cls = r.research_classification as any;
      if (!cls?.primary_reason_code) return false;

      // Skip already reclassified
      const audit = (r as any).research_audit;
      if (audit && audit.type === 'one_time_reclassification') return false;

      const code = cls.primary_reason_code;
      const codeLower = code.toLowerCase();
      const transcript = r.call_transcription || '';

      // Skip short transcripts
      if (transcript.length < 50) return false;

      // "Other" or variants
      if (codeLower.includes('other') || codeLower.includes('unspecified') ||
          codeLower.includes('unknown') || codeLower.includes('general')) {
        return true;
      }

      // Suspicious "Buying a Home" with high preventability
      if (codeLower.includes('buying') && codeLower.includes('home')) {
        const score = parseInt(cls.preventability_score);
        if (!isNaN(score) && score >= 4) return true;
      }

      // Non-standard code
      if (!VALID_CODES.includes(code)) return true;

      return false;
    });

    // We need research_audit too - re-query with that field
    // Actually let's fix: fetch research_audit in the initial query
    // For now, do a second query for audit status
    const needsIds = needsReclass.map(r => r.id);

    // Check audit status
    let finalCandidates = needsReclass;
    if (needsIds.length > 0) {
      const { data: auditCheck } = await supabase
        .from('booking_transcriptions')
        .select('id, research_audit')
        .in('id', needsIds.slice(0, 200));

      const auditMap = new Map((auditCheck || []).map(a => [a.id, a.research_audit]));
      finalCandidates = needsReclass.filter(r => {
        const audit = auditMap.get(r.id) as any;
        return !audit || audit.type !== 'one_time_reclassification';
      });
    }

    const totalRemaining = finalCandidates.length;
    const batch = finalCandidates.slice(0, BATCH_SIZE);

    if (batch.length === 0) {
      return new Response(JSON.stringify({
        batch_processed: 0, remaining: 0, results: [], message: 'No records need reclassification',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let processed = 0;
    const results: any[] = [];

    for (const record of batch) {
      try {
        const transcript = record.call_transcription || '';
        const aiResult = await callLovableAI(apiKey, transcript);

        let parsed: any;
        try {
          const jsonMatch = aiResult.content.match(/```(?:json)?\s*([\s\S]*?)```/);
          const clean = jsonMatch ? jsonMatch[1].trim() : aiResult.content.trim();
          parsed = JSON.parse(clean);
        } catch {
          console.error(`[Reclassify] Failed to parse AI response for ${record.id}`);
          continue;
        }

        const oldCode = (record.research_classification as any)?.primary_reason_code || 'Unknown';
        const newCode = parsed.primary_reason_code;
        const isDataError = newCode === 'Data Error / Invalid Record';

        // Build updated classification preserving extraction data
        const updatedClassification = {
          ...(record.research_classification as any),
          primary_reason_code: newCode,
          primary_reason_detail: parsed.reason_detail || (record.research_classification as any)?.primary_reason_detail,
          preventability_score: parsed.preventability_score,
          addressability: parsed.addressability,
          key_quotes: parsed.key_quotes,
          case_summary: parsed.case_summary,
          human_review_recommended: parsed.human_review_recommended,
          stated_vs_actual_match: parsed.stated_vs_actual_match,
          stated_reason_summary: parsed.stated_reason_summary,
          actual_reason_summary: parsed.actual_reason_summary,
        };

        const auditData = {
          type: 'one_time_reclassification',
          original_code: oldCode,
          original_classification: record.research_classification,
          reclassified_at: new Date().toISOString(),
          reclassified_by: 'system',
        };

        const updatePayload: any = {
          research_classification: updatedClassification,
          research_audit: auditData,
        };

        if (isDataError) {
          updatePayload.research_human_review = true;
        }

        const { error: updateError } = await supabase
          .from('booking_transcriptions')
          .update(updatePayload)
          .eq('id', record.id);

        if (updateError) {
          console.error(`[Reclassify] Update failed for ${record.id}:`, updateError);
          continue;
        }

        processed++;
        results.push({
          id: record.id,
          old_code: oldCode,
          new_code: newCode,
          stated_vs_actual_match: parsed.stated_vs_actual_match ?? null,
        });

        // Log cost
        await supabase.from('api_costs').insert({
          service_provider: 'lovable_ai',
          service_type: 'reclassification',
          edge_function: 'reclassify-records',
          booking_id: null,
          input_tokens: aiResult.inputTokens,
          output_tokens: aiResult.outputTokens,
          estimated_cost_usd: ((aiResult.inputTokens * 0.0000003) + (aiResult.outputTokens * 0.0000025)),
          is_internal: true,
          metadata: { record_id: record.id, model: 'google/gemini-2.5-flash', old_code: oldCode, new_code: newCode },
        });

        // 1-second delay between calls
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.error(`[Reclassify] Error processing ${record.id}:`, err);
      }
    }

    // Self-chain if more remain
    const remaining = totalRemaining - processed;
    let chained = false;

    if (remaining > 0 && batch.length === BATCH_SIZE) {
      try {
        fetch(`${supabaseUrl}/functions/v1/reclassify-records`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ continuation: true }),
        });
        chained = true;
      } catch (chainErr) {
        console.error('[Reclassify] Failed to chain next batch:', chainErr);
      }
    }

    return new Response(JSON.stringify({
      batch_processed: processed,
      remaining,
      chained,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[Reclassify] Fatal error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
