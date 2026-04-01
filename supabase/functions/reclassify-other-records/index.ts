import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 10;

const RECLASSIFICATION_PROMPT = `You are classifying a PadSplit member move-out call. Based on the transcript and extracted data below, assign this record to ONE of these specific reason codes.

CLASSIFICATION RULES — MANDATORY:
Classify this record into EXACTLY ONE of these 7 codes. "Other" is NOT a valid option. Every record MUST be assigned to one of these:

1. "Host Negligence / Property Condition" — property issues, maintenance, mold, pests, dirty, uninhabitable, host unresponsive, misrepresentation, renovation issues, overcrowding due to host
2. "Payment Friction / Financial Hardship" — can't afford, rent increase, rent too high, payment schedules, late fees, collections, billing disputes, pricing concerns, saving money
3. "Roommate Conflict / Safety Concern" — roommate issues, noise, cleanliness from roommates, harassment, drugs, theft, safety fears, assault, hostile environment from other members
4. "Communication Breakdown / Support Dissatisfaction" — PadSplit support unresponsive, conflicting info, feeling unheard, process failures, app issues, platform problems
5. "Policy Confusion / Lack of Flexibility" — transfer rules, guest policies, house rules, expectations vs reality, shared bathroom/kitchen objection, didn't realize it was shared living
6. "External Life Event / Positive Move-On" — buying home, job relocation, family, graduation, personal reasons, temporary housing, moving out of town, needed own space, incarceration, health issues, military, got arrested, relationship change, found other housing, wanted independence, vague "personal reasons", "just because" with no PadSplit complaint
7. "Data Error / Invalid Record" — member never moved in, wrong person contacted, identity theft, duplicate record, member denies move-out, call too short for classification. Always set human_review_recommended = true.

EDGE CASE RULES:
- Vague reasons ("personal", "just because", "needed a change") with NO specific PadSplit complaint = External Life Event
- "Needed my own space" / "wanted independence" = External Life Event
- "Rent too high" / "can't afford" / "price increase" = Payment Friction
- "Didn't like sharing bathroom/kitchen" = Policy Confusion
- "Got arrested" / "going through something" = External Life Event
- If member gives vague reason but transcript reveals a real issue later, classify based on the ACTUAL issue
- If multiple issues, pick the one discussed most or that upset the member most
- If transcript is unintelligible or under 30 words = Data Error
- NEVER output "Other", "Unspecified", "Unknown", or "General"

Respond with ONLY a JSON object:
{
  "primary_reason_code": "[one of the 7 codes above]",
  "primary_reason_detail": "[1-2 sentence explanation]",
  "reclassification_reasoning": "[why this was originally 'Other' and why the new code is correct]",
  "confidence": "high" | "medium" | "low"
}`;

async function callLovableAI(
  apiKey: string,
  userPrompt: string
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
        { role: 'system', content: RECLASSIFICATION_PROMPT },
        { role: 'user', content: userPrompt },
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

    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const dryRun = body.dry_run || false;

    // Fetch batch of "Other" records
    const { data: records, error: fetchError } = await supabase
      .from('booking_transcriptions')
      .select('id, call_transcription, research_extraction, research_classification')
      .eq('research_campaign_type', 'move_out_survey')
      .not('research_classification', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (fetchError) throw fetchError;

    // Filter to "Other" records client-side (PostgREST JSONB filtering can be tricky)
    const otherRecords = (records || []).filter((r: any) => {
      const code = (r.research_classification as any)?.primary_reason_code || '';
      return code === 'Other' || code.toLowerCase().includes('other') || code.toLowerCase().includes('unspecified');
    });

    if (dryRun) {
      // Count total "Other" records
      const { data: allRecords } = await supabase
        .from('booking_transcriptions')
        .select('id, research_classification')
        .eq('research_campaign_type', 'move_out_survey')
        .not('research_classification', 'is', null);

      const totalOther = (allRecords || []).filter((r: any) => {
        const code = (r.research_classification as any)?.primary_reason_code || '';
        return code === 'Other' || code.toLowerCase().includes('other') || code.toLowerCase().includes('unspecified');
      }).length;

      return new Response(JSON.stringify({ total_other: totalOther }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Also fetch total count for progress
    const { data: allOtherRecords } = await supabase
      .from('booking_transcriptions')
      .select('id, research_classification')
      .eq('research_campaign_type', 'move_out_survey')
      .not('research_classification', 'is', null);

    const totalOther = (allOtherRecords || []).filter((r: any) => {
      const code = (r.research_classification as any)?.primary_reason_code || '';
      return code === 'Other' || code.toLowerCase().includes('other') || code.toLowerCase().includes('unspecified');
    }).length;

    let reclassified = 0;
    let errors = 0;
    const results: any[] = [];

    for (const record of otherRecords) {
      try {
        const transcript = record.call_transcription || '(No transcript available)';
        const extraction = JSON.stringify(record.research_extraction || {}, null, 2);
        const classification = JSON.stringify(record.research_classification || {}, null, 2);

        const userPrompt = `TRANSCRIPT:\n${transcript.substring(0, 8000)}\n\nEXTRACTED DATA:\n${extraction}\n\nCURRENT CLASSIFICATION:\n${classification}`;

        const aiResult = await callLovableAI(apiKey, userPrompt);

        let parsed: any;
        try {
          const jsonMatch = aiResult.content.match(/```(?:json)?\s*([\s\S]*?)```/);
          const clean = jsonMatch ? jsonMatch[1].trim() : aiResult.content.trim();
          parsed = JSON.parse(clean);
        } catch {
          console.error(`[Reclassify] Failed to parse AI response for ${record.id}`);
          errors++;
          continue;
        }

        const newCode = parsed.primary_reason_code;
        const isDataError = newCode === 'Data Error / Invalid Record';

        // Build updated classification
        const updatedClassification = {
          ...(record.research_classification as any),
          primary_reason_code: newCode,
          primary_reason_detail: parsed.primary_reason_detail || (record.research_classification as any)?.primary_reason_detail,
        };

        const auditData = {
          type: 'ai_reclassification',
          original_code: 'Other',
          new_code: newCode,
          reasoning: parsed.reclassification_reasoning,
          confidence: parsed.confidence,
          reclassified_at: new Date().toISOString(),
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
          errors++;
        } else {
          reclassified++;
          results.push({
            id: record.id,
            old_code: 'Other',
            new_code: newCode,
            confidence: parsed.confidence,
          });
        }

        // Log cost
        await supabase.from('api_costs').insert({
          service_provider: 'lovable_ai',
          service_type: 'reclassification',
          edge_function: 'reclassify-other-records',
          booking_id: null,
          input_tokens: aiResult.inputTokens,
          output_tokens: aiResult.outputTokens,
          estimated_cost_usd: ((aiResult.inputTokens * 0.0000003) + (aiResult.outputTokens * 0.0000025)),
          is_internal: true,
          metadata: { record_id: record.id, model: 'google/gemini-2.5-flash' },
        });

        // Small delay between records
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`[Reclassify] Error processing ${record.id}:`, err);
        errors++;
      }
    }

    // Self-chain if there are more records
    const remainingOther = totalOther - reclassified;
    let chained = false;

    if (otherRecords.length === BATCH_SIZE && remainingOther > 0) {
      // Trigger next batch
      try {
        const functionUrl = `${supabaseUrl}/functions/v1/reclassify-other-records`;
        await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ offset: offset + BATCH_SIZE }),
        });
        chained = true;
      } catch (chainErr) {
        console.error('[Reclassify] Failed to chain next batch:', chainErr);
      }
    }

    return new Response(JSON.stringify({
      batch_offset: offset,
      batch_size: otherRecords.length,
      reclassified,
      errors,
      total_remaining: remainingOther,
      chained,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[Reclassify] Fatal error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
