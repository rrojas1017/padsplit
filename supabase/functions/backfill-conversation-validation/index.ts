import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 50;
const RESEARCH_MIN_DURATION = 120;

function validateConversation(params: {
  durationSeconds: number | null;
  transcription: string;
  summary: string;
}): boolean {
  const { durationSeconds, transcription, summary } = params;
  const lowerTranscription = transcription.toLowerCase();
  const lowerSummary = summary.toLowerCase();

  if (durationSeconds && durationSeconds < 15) return false;

  const voicemailIndicators = [
    'forwarded to voicemail', 'leave your message', 'leave a message',
    'not available', 'at the tone', 'please record your message',
    'mailbox is full', 'record your message at the tone',
    'the person you are calling', 'is not available right now',
    'after the beep', 'voice mailbox', 'voicemail', 'answering machine',
    'automated voice',
  ];

  const noConversationIndicators = [
    'no actual conversation', 'voicemail recording', 'voicemail',
    'no discussion', 'no conversation took place', 'no contact was made',
    'voicemail greeting', 'failed to connect', 'no meaningful dialogue',
    'no two-way conversation', 'one-sided recording', 'automated voicemail',
    'extremely brief', 'no further conversation', 'hung up', 'disconnected',
    'wrong number', 'answering machine', 'automated voice', 'cuts off',
    'cut off before', 'no information was exchanged', 'incomplete',
    'no substantive', 'no interaction', 'no real conversation',
    'no meaningful', 'not a sales call', 'no conversation',
  ];

  if (durationSeconds && durationSeconds < 30) {
    if (voicemailIndicators.some(i => lowerTranscription.includes(i))) return false;
    if (voicemailIndicators.some(i => lowerSummary.includes(i))) return false;
  }

  if (noConversationIndicators.some(i => lowerSummary.includes(i))) return false;
  if (noConversationIndicators.some(i => lowerTranscription.includes(i))) return false;

  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Fetch all research bookings with NULL has_valid_conversation and completed transcription
    const { data: records, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        id,
        call_duration_seconds,
        booking_transcriptions!inner (
          call_transcription,
          call_summary
        )
      `)
      .eq('record_type', 'research')
      .is('has_valid_conversation', null)
      .eq('transcription_status', 'completed')
      .limit(500);

    if (fetchError) throw fetchError;

    if (!records || records.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No records to backfill', valid: 0, invalid: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let validCount = 0;
    let invalidCount = 0;

    // Process in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (record: any) => {
        const t = Array.isArray(record.booking_transcriptions)
          ? record.booking_transcriptions[0]
          : record.booking_transcriptions;

        const transcription = t?.call_transcription || '';
        const summary = t?.call_summary || '';
        const duration = record.call_duration_seconds;

        // Step 1: keyword-based validation
        let isValid = validateConversation({ durationSeconds: duration, transcription, summary });

        // Step 2: research-specific 120s minimum
        if (isValid && (!duration || duration < RESEARCH_MIN_DURATION)) {
          console.log(`[Backfill] Record ${record.id} below research minimum (${duration}s < ${RESEARCH_MIN_DURATION}s)`);
          isValid = false;
        }

        const { error: updateError } = await supabase
          .from('bookings')
          .update({ has_valid_conversation: isValid })
          .eq('id', record.id);

        if (updateError) {
          console.error(`[Backfill] Failed to update ${record.id}: ${updateError.message}`);
        } else {
          if (isValid) validCount++;
          else invalidCount++;
        }
      }));
    }

    console.log(`[Backfill] Complete: ${validCount} valid, ${invalidCount} invalid out of ${records.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        total: records.length,
        valid: validCount,
        invalid: invalidCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Backfill] Error:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
