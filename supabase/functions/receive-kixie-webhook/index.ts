import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Kixie webhook payload structure
interface KixieWebhookPayload {
  callid?: string;
  recordingurl?: string;
  calltype?: string; // 'inbound' or 'outbound'
  calldisposition?: string;
  duration?: string | number;
  agent_name?: string;
  agent_email?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  from_number?: string;
  to_number?: string;
  hubspot_link?: string;
  call_status?: string; // 'answered', 'missed', 'voicemail'
  [key: string]: unknown;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Check if webhook is active
    const { data: settings, error: settingsError } = await supabase
      .from('webhook_settings')
      .select('*')
      .eq('provider', 'kixie')
      .maybeSingle();

    if (settingsError) {
      console.error('[Kixie Webhook] Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings?.is_active) {
      console.log('[Kixie Webhook] Webhook is disabled');
      return new Response(
        JSON.stringify({ error: 'Webhook is disabled' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate webhook secret if configured
    if (settings.webhook_secret) {
      const providedSecret = req.headers.get('x-webhook-secret');
      if (providedSecret !== settings.webhook_secret) {
        console.error('[Kixie Webhook] Invalid webhook secret');
        return new Response(
          JSON.stringify({ error: 'Invalid webhook secret' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Parse webhook payload
    const payload: KixieWebhookPayload = await req.json();
    console.log('[Kixie Webhook] Received payload:', JSON.stringify(payload).substring(0, 500));

    // Validate required fields
    if (!payload.callid) {
      console.error('[Kixie Webhook] Missing callid');
      return new Response(
        JSON.stringify({ error: 'Missing callid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if call already exists
    const { data: existingCall } = await supabase
      .from('calls')
      .select('id')
      .eq('kixie_call_id', payload.callid)
      .maybeSingle();

    if (existingCall) {
      console.log(`[Kixie Webhook] Call ${payload.callid} already exists`);
      return new Response(
        JSON.stringify({ success: true, message: 'Call already exists', callId: existingCall.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Match agent by email and get site info for TTS logic
    let agentId: string | null = null;
    let siteName: string | null = null;
    
    if (payload.agent_email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', payload.agent_email.toLowerCase())
        .maybeSingle();
      
      if (profile) {
        const { data: agent } = await supabase
          .from('agents')
          .select('id, sites(name)')
          .eq('user_id', profile.id)
          .maybeSingle();
        
        if (agent) {
          agentId = agent.id;
          siteName = (agent as unknown as { id: string; sites: { name: string } | null }).sites?.name || null;
          console.log(`[Kixie Webhook] Matched agent: ${agentId}, site: ${siteName}`);
        }
      }
    }

    // If agent not found by email, try by name
    if (!agentId && payload.agent_name) {
      const { data: agent } = await supabase
        .from('agents')
        .select('id, sites(name)')
        .ilike('name', payload.agent_name)
        .maybeSingle();
      
      if (agent) {
        agentId = agent.id;
        siteName = (agent as unknown as { id: string; sites: { name: string } | null }).sites?.name || null;
        console.log(`[Kixie Webhook] Matched agent by name: ${agentId}, site: ${siteName}`);
      }
    }

    // Parse duration
    const durationSeconds = typeof payload.duration === 'number' 
      ? payload.duration 
      : parseInt(payload.duration || '0', 10);

    // Determine call type and status
    const callType = payload.calltype?.toLowerCase().includes('inbound') ? 'incoming' : 'outgoing';
    const callStatus = payload.call_status || 'answered';

    // Create call record
    const { data: newCall, error: insertError } = await supabase
      .from('calls')
      .insert({
        kixie_call_id: payload.callid,
        recording_url: payload.recordingurl || null,
        call_type: callType,
        call_status: callStatus,
        call_date: new Date().toISOString(),
        duration_seconds: durationSeconds,
        from_number: payload.from_number || null,
        to_number: payload.to_number || null,
        kixie_agent_name: payload.agent_name || null,
        kixie_agent_email: payload.agent_email || null,
        agent_id: agentId,
        contact_name: payload.contact_name || null,
        contact_phone: payload.contact_phone || null,
        contact_email: payload.contact_email || null,
        hubspot_link: payload.hubspot_link || null,
        disposition: payload.calldisposition || null,
        transcription_status: 'pending',
        source: 'webhook',
        raw_webhook_data: payload,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[Kixie Webhook] Error inserting call:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save call' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Kixie Webhook] Created call: ${newCall.id}`);

    // Check if we should auto-transcribe
    const shouldTranscribe = settings.auto_transcribe 
      && payload.recordingurl 
      && durationSeconds >= (settings.min_duration_seconds || 30);

    if (shouldTranscribe) {
      // Determine skipTts: only Vixicom agents get TTS for live webhook calls
      const isVixicom = siteName?.toLowerCase().includes('vixicom') || false;
      const skipTts = !isVixicom;
      
      console.log(`[Kixie Webhook] Triggering transcription for call ${newCall.id} (skipTts: ${skipTts}, site: ${siteName})`);
      
      // Trigger transcription (fire-and-forget)
      fetch(`${supabaseUrl}/functions/v1/transcribe-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          callId: newCall.id,
          kixieUrl: payload.recordingurl,
          skipTts,
        }),
      }).then(res => {
        if (res.ok) {
          console.log(`[Kixie Webhook] Transcription triggered for call ${newCall.id}`);
        } else {
          console.error(`[Kixie Webhook] Transcription trigger failed: ${res.status}`);
        }
      }).catch(err => {
        console.error('[Kixie Webhook] Transcription trigger error:', err);
      });
    } else {
      console.log(`[Kixie Webhook] Skipping transcription: auto=${settings.auto_transcribe}, hasUrl=${!!payload.recordingurl}, duration=${durationSeconds}s, minDuration=${settings.min_duration_seconds}s`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        callId: newCall.id,
        transcriptionTriggered: shouldTranscribe,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Kixie Webhook] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
