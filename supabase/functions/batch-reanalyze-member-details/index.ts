import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Build extraction prompt focused only on memberDetails
function buildMemberDetailsExtractionPrompt(transcription: string): string {
  return `You are an expert at extracting member contact and booking details from sales call transcriptions for PadSplit, a housing/rental service.

CRITICAL INSTRUCTIONS:
1. Extract ALL contact and booking details mentioned in the call
2. Listen for phone numbers being confirmed, stated, or verified
3. Capture email addresses if mentioned
4. Note budget amounts, move-in dates, and household information
5. If information is not mentioned, return null for that field

TRANSCRIPTION:
${transcription}

Return a JSON object with EXACTLY this structure (no markdown, just raw JSON):
{
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
  }
}

EXTRACTION TIPS:
- Phone numbers may be read digit by digit or in groups
- Budget could be stated as weekly, monthly (divide by 4), or per paycheck
- Move-in date might be relative ("this Friday", "next week") - capture as stated
- Household size includes the member plus anyone moving in with them
- Property addresses may be partial (street name only, neighborhood, etc.)

Return ONLY the JSON object, no additional text.`;
}

// Call AI to extract member details
async function extractMemberDetails(
  lovableApiKey: string,
  transcription: string
): Promise<any> {
  const prompt = buildMemberDetailsExtractionPrompt(transcription);
  
  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
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
  const aiContent = aiResult.choices?.[0]?.message?.content || '';
  
  // Clean and parse JSON
  let cleanedContent = aiContent.trim();
  if (cleanedContent.startsWith('```json')) {
    cleanedContent = cleanedContent.slice(7);
  }
  if (cleanedContent.startsWith('```')) {
    cleanedContent = cleanedContent.slice(3);
  }
  if (cleanedContent.endsWith('```')) {
    cleanedContent = cleanedContent.slice(0, -3);
  }
  cleanedContent = cleanedContent.trim();
  
  const parsed = JSON.parse(cleanedContent);
  return parsed.memberDetails || null;
}

// Background processing function
async function processTranscriptions(supabase: any, lovableApiKey: string, limit: number) {
  console.log(`[BatchMemberDetails] Starting batch processing, limit: ${limit}`);
  
  // Fetch transcriptions that need member details extraction
  const { data: transcriptions, error: fetchError } = await supabase
    .from('booking_transcriptions')
    .select('booking_id, call_transcription, call_key_points')
    .not('call_transcription', 'is', null)
    .limit(limit);

  if (fetchError) {
    console.error('[BatchMemberDetails] Error fetching transcriptions:', fetchError);
    return { succeeded: 0, failed: 0, skipped: 0 };
  }

  // Filter to only those missing memberDetails
  const toProcess = transcriptions?.filter((t: any) => {
    const keyPoints = t.call_key_points;
    return !keyPoints?.memberDetails;
  }) || [];

  console.log(`[BatchMemberDetails] Found ${transcriptions?.length || 0} transcriptions, ${toProcess.length} need processing`);

  let succeeded = 0;
  let failed = 0;
  let skipped = transcriptions?.length - toProcess.length || 0;

  for (let i = 0; i < toProcess.length; i++) {
    const trans = toProcess[i];
    console.log(`[BatchMemberDetails] Processing ${i + 1}/${toProcess.length}: booking_id=${trans.booking_id}`);

    try {
      // Extract member details from transcription
      const memberDetails = await extractMemberDetails(lovableApiKey, trans.call_transcription);
      
      if (!memberDetails) {
        console.log(`[BatchMemberDetails] No member details extracted for booking ${trans.booking_id}`);
        succeeded++; // Still count as success, just no data to extract
        continue;
      }

      // Merge memberDetails into existing call_key_points
      const updatedKeyPoints = {
        ...(trans.call_key_points || {}),
        memberDetails
      };

      // Update the booking_transcriptions record
      const { error: updateError } = await supabase
        .from('booking_transcriptions')
        .update({ 
          call_key_points: updatedKeyPoints,
          updated_at: new Date().toISOString()
        })
        .eq('booking_id', trans.booking_id);

      if (updateError) {
        console.error(`[BatchMemberDetails] Error updating booking ${trans.booking_id}:`, updateError);
        failed++;
      } else {
        console.log(`[BatchMemberDetails] Successfully updated booking ${trans.booking_id}:`, {
          firstName: memberDetails.firstName,
          phoneNumber: memberDetails.phoneNumber ? 'extracted' : null,
          email: memberDetails.email ? 'extracted' : null,
          weeklyBudget: memberDetails.weeklyBudget
        });
        succeeded++;
      }
    } catch (error) {
      console.error(`[BatchMemberDetails] Error processing booking ${trans.booking_id}:`, error);
      failed++;
    }

    // 10-second delay between requests (per project pattern)
    if (i < toProcess.length - 1) {
      console.log(`[BatchMemberDetails] Waiting 10 seconds before next request...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  console.log(`[BatchMemberDetails] Batch complete: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped (already had memberDetails)`);
  return { succeeded, failed, skipped };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Parse optional limit from request body
    let limit = 100;
    try {
      const body = await req.json();
      if (body.limit && typeof body.limit === 'number') {
        limit = Math.min(body.limit, 200); // Cap at 200
      }
    } catch {
      // No body or invalid JSON, use default limit
    }

    console.log(`[BatchMemberDetails] Starting batch extraction with limit ${limit}`);

    // Fire-and-forget: start processing in background
    (globalThis as any).EdgeRuntime?.waitUntil?.(processTranscriptions(supabase, lovableApiKey, limit)) 
      || processTranscriptions(supabase, lovableApiKey, limit);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Batch member details extraction started. Processing up to ${limit} transcriptions in background.` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[BatchMemberDetails] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
