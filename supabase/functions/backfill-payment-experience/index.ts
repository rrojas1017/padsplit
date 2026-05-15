import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYMENT_SCRIPT_ID = 'c701a243-1c66-425a-8f79-99a290ec5b6b';

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Find all campaigns linked to the Payment Experience script
    const { data: campaigns, error: cErr } = await supabase
      .from('research_campaigns')
      .select('id')
      .eq('script_id', PAYMENT_SCRIPT_ID);
    if (cErr) throw cErr;
    const campaignIds = (campaigns || []).map((c: any) => c.id);

    let bookingIds: string[] = [];

    if (campaignIds.length > 0) {
      // 2. research_calls for those campaigns
      const { data: calls } = await supabase
        .from('research_calls')
        .select('id')
        .in('campaign_id', campaignIds);
      const callIds = (calls || []).map((c: any) => c.id);

      if (callIds.length > 0) {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id')
          .in('research_call_id', callIds);
        bookingIds = (bookings || []).map((b: any) => b.id);
      }
    }

    let retagged = 0;
    if (bookingIds.length > 0) {
      const { data: updated } = await supabase
        .from('booking_transcriptions')
        .update({
          research_campaign_type: 'payment_experience',
          research_processing_status: null,
          research_extraction: null,
          research_classification: null,
        })
        .in('booking_id', bookingIds)
        .select('id');
      retagged = updated?.length || 0;
    }

    // 3. Trigger batch processing in background
    if (retagged > 0) {
      EdgeRuntime.waitUntil(
        fetch(`${supabaseUrl}/functions/v1/batch-process-research-records`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'start' }),
        }).then(() => undefined).catch((e) => console.error('[BackfillPE] batch trigger failed', e))
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaigns_found: campaignIds.length,
        bookings_found: bookingIds.length,
        retagged,
        message: retagged > 0
          ? `Re-tagged ${retagged} records and triggered processing`
          : 'No Payment Experience calls found yet (campaign empty)',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BackfillPE] Error:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
