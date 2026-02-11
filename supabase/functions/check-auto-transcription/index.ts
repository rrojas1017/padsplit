import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: 'Missing bookingId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-auto-transcription] Checking rules for booking ${bookingId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch booking with agent info and site name for TTS logic
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        kixie_link,
        agent_id,
        call_type_id,
        import_batch_id,
        agents(id, site_id, sites(name))
      `)
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      console.log(`[check-auto-transcription] Booking not found: ${bookingId}`);
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract fields - Supabase returns agents as object for single FK
    const bookingData = booking as unknown as {
      id: string;
      kixie_link: string | null;
      agent_id: string;
      call_type_id: string | null;
      import_batch_id: string | null;
      agents: { id: string; site_id: string; sites: { name: string } | null } | null;
    };

    // Check if booking has kixie_link
    if (!bookingData.kixie_link) {
      console.log(`[check-auto-transcription] No kixie_link for booking ${bookingId}`);
      return new Response(
        JSON.stringify({ triggered: false, reason: 'No kixie_link' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atomic claim: only proceed if status is NULL or 'failed'
    // This prevents duplicate processing when multiple triggers fire
    const { data: claimResult, error: claimError } = await supabase
      .from('bookings')
      .update({ transcription_status: 'queued' })
      .eq('id', bookingId)
      .or('transcription_status.is.null,transcription_status.eq.failed')
      .select('id')
      .maybeSingle();

    // Handle schema cache errors (e.g., after migrations, PostgREST may not recognize columns)
    if (claimError) {
      if (claimError.code === '42703') {
        // Column not found -- stale schema cache. Skip claim and proceed directly.
        // transcribe-call has its own idempotency checks so this is safe.
        console.warn(`[check-auto-transcription] Schema cache stale (42703) for booking ${bookingId}. Bypassing claim and proceeding directly.`);
      } else {
        console.error(`[check-auto-transcription] Claim error:`, claimError);
        return new Response(
          JSON.stringify({ triggered: false, reason: 'Claim error' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (!claimResult) {
      console.log(`[check-auto-transcription] Booking ${bookingId} already claimed by another invocation, skipping`);
      return new Response(
        JSON.stringify({ triggered: false, reason: 'Already claimed by another invocation' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log(`[check-auto-transcription] Successfully claimed booking ${bookingId} for transcription`);
    }

    // Fetch all active rules ordered by priority
    const { data: rules, error: rulesError } = await supabase
      .from('transcription_auto_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (rulesError) {
      console.error(`[check-auto-transcription] Error fetching rules:`, rulesError);
      return new Response(
        JSON.stringify({ triggered: false, reason: 'Error fetching rules' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rules || rules.length === 0) {
      console.log(`[check-auto-transcription] No auto-transcription rules configured`);
      return new Response(
        JSON.stringify({ triggered: false, reason: 'No rules configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find matching rule (priority order: agent > call_type > site > global)
    let matchedRule = null;

    // Check agent-specific rules first
    const agentRule = rules.find(r => r.rule_type === 'agent' && r.agent_id === bookingData.agent_id);
    if (agentRule) {
      matchedRule = agentRule;
      console.log(`[check-auto-transcription] Matched agent rule: ${agentRule.id}`);
    }

    // Check call_type-specific rules
    if (!matchedRule && bookingData.call_type_id) {
      const callTypeRule = rules.find(r => r.rule_type === 'call_type' && r.call_type_id === bookingData.call_type_id);
      if (callTypeRule) {
        matchedRule = callTypeRule;
        console.log(`[check-auto-transcription] Matched call_type rule: ${callTypeRule.id}`);
      }
    }

    // Check site-specific rules
    if (!matchedRule && bookingData.agents?.site_id) {
      const siteRule = rules.find(r => r.rule_type === 'site' && r.site_id === bookingData.agents?.site_id);
      if (siteRule) {
        matchedRule = siteRule;
        console.log(`[check-auto-transcription] Matched site rule: ${siteRule.id}`);
      }
    }

    // Check global rule
    if (!matchedRule) {
      const globalRule = rules.find(r => r.rule_type === 'global');
      if (globalRule) {
        matchedRule = globalRule;
        console.log(`[check-auto-transcription] Matched global rule: ${globalRule.id}`);
      }
    }

    if (!matchedRule) {
      console.log(`[check-auto-transcription] No matching rule found for booking ${bookingId}`);
      return new Response(
        JSON.stringify({ triggered: false, reason: 'No matching rule' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!matchedRule.auto_transcribe) {
      console.log(`[check-auto-transcription] Rule matched but auto_transcribe is disabled`);
      return new Response(
        JSON.stringify({ triggered: false, reason: 'Auto-transcribe disabled for this rule' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine skipTts: imported records skip TTS, manual Vixicom records get TTS
    const siteName = bookingData.agents?.sites?.name || '';
    const isVixicom = siteName.toLowerCase().includes('vixicom');
    const isImported = !!bookingData.import_batch_id;
    const skipTts = isImported || !isVixicom;
    
    console.log(`[check-auto-transcription] Triggering transcription for booking ${bookingId} (skipTts: ${skipTts}, imported: ${isImported}, site: ${siteName})`);
    
    const transcribeResponse = await fetch(`${supabaseUrl}/functions/v1/transcribe-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        bookingId: bookingData.id,
        kixieUrl: bookingData.kixie_link,
        skipTts,
      }),
    });

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error(`[check-auto-transcription] Failed to trigger transcription:`, errorText);
      return new Response(
        JSON.stringify({ triggered: false, reason: 'Failed to trigger transcription' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-auto-transcription] Successfully triggered transcription for booking ${bookingId}`);
    
    return new Response(
      JSON.stringify({ 
        triggered: true, 
        ruleType: matchedRule.rule_type,
        ruleId: matchedRule.id,
        autoCoaching: matchedRule.auto_coaching
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[check-auto-transcription] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
