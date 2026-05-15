import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

// Payment-related keywords. A row qualifies if its transcript matches >= MIN_MATCHES distinct keywords.
const KEYWORDS = [
  'auto-pay', 'autopay', 'auto pay',
  'hardship',
  'due date', 'payment due',
  'weekly payment', 'weekly dues',
  'card declined', 'declined',
  'payment plan',
  'late fee', 'overdue',
  'pay cycle', 'pay period',
  'payment method',
];
const MIN_MATCHES = 3;
const PAGE_SIZE = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch candidate transcripts (not already tagged payment_experience), paginated.
    let from = 0;
    const matchedIds: string[] = [];
    let scanned = 0;

    while (true) {
      const { data, error } = await supabase
        .from('booking_transcriptions')
        .select('id, call_transcription, research_campaign_type')
        .not('call_transcription', 'is', null)
        .neq('call_transcription', '')
        .or('research_campaign_type.is.null,research_campaign_type.neq.payment_experience')
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      scanned += data.length;

      for (const row of data) {
        const t = (row.call_transcription || '').toLowerCase();
        if (!t) continue;
        let hits = 0;
        for (const kw of KEYWORDS) {
          if (t.includes(kw)) hits++;
          if (hits >= MIN_MATCHES) break;
        }
        if (hits >= MIN_MATCHES) matchedIds.push(row.id);
      }

      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    let retagged = 0;
    if (matchedIds.length > 0) {
      const { data: updated, error: updErr } = await supabase
        .from('booking_transcriptions')
        .update({
          research_campaign_type: 'payment_experience',
          research_processing_status: null,
          research_extraction: null,
          research_classification: null,
          retag_source: 'payment_keyword_validation',
        })
        .in('id', matchedIds)
        .select('id');
      if (updErr) throw updErr;
      retagged = updated?.length || 0;
    }

    let batch_triggered = false;
    if (retagged > 0) {
      EdgeRuntime.waitUntil(
        fetch(`${supabaseUrl}/functions/v1/batch-process-research-records`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'start' }),
        }).then(() => undefined).catch((e) => console.error('[ValidatePEBackfill] batch trigger failed', e))
      );
      batch_triggered = true;
    }

    console.log(`[ValidatePEBackfill] scanned=${scanned} matched=${matchedIds.length} retagged=${retagged}`);

    return new Response(
      JSON.stringify({
        success: true,
        scanned,
        matched: matchedIds.length,
        retagged,
        batch_triggered,
        keyword_threshold: MIN_MATCHES,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ValidatePEBackfill] Error:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
