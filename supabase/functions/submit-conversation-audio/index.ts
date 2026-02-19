import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // --- Authenticate via API Credentials (client_id + client_secret) ---
    const clientId = req.headers.get('x-client-id');
    const clientSecret = req.headers.get('x-client-secret');

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized: missing API credentials' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const secretHash = await sha256Hex(clientSecret);

    const { data: credential, error: credError } = await adminClient
      .from('api_credentials')
      .select('id, status, expires_at')
      .eq('client_id', clientId)
      .eq('client_secret_hash', secretHash)
      .is('deleted_at', null)
      .single();

    if (credError || !credential) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid API credentials' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (credential.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Unauthorized: credential is ' + credential.status }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (credential.expires_at && new Date(credential.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Unauthorized: credential expired' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update last_used_at
    await adminClient.from('api_credentials').update({ last_used_at: new Date().toISOString() }).eq('id', credential.id);

    // --- Parse & validate body ---
    const body = await req.json();
    const { audioUrl, dialerAgentUser, phoneNumber, campaign, type } = body;

    const errors: string[] = [];
    if (!audioUrl || typeof audioUrl !== 'string') errors.push('audioUrl is required');
    if (!dialerAgentUser || typeof dialerAgentUser !== 'string') errors.push('dialerAgentUser is required');
    if (!phoneNumber || typeof phoneNumber !== 'string') errors.push('phoneNumber is required');
    if (!campaign || typeof campaign !== 'string') errors.push('campaign is required');
    if (!type || typeof type !== 'string') errors.push('type is required');
    if (type && type !== 'research') errors.push('type must be "research"');

    if (errors.length > 0) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: errors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Match dialerAgentUser to internal agent ---
    const { data: agent, error: agentError } = await adminClient
      .from('agents')
      .select('id, name, site_id')
      .eq('dialer_agent_user', dialerAgentUser)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: 'Agent not found for dialerAgentUser: ' + dialerAgentUser }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Insert booking record (research type) for Reports visibility ---
    const today = new Date().toISOString().split('T')[0];
    const { data: booking, error: bookingError } = await adminClient
      .from('bookings')
      .insert({
        member_name: 'API Submission - ' + phoneNumber,
        booking_type: 'Research',
        status: 'Research',
        record_type: 'research',
        agent_id: agent.id,
        booking_date: today,
        move_in_date: today,
        contact_phone: phoneNumber,
        kixie_link: audioUrl,
        notes: `Campaign: ${campaign} | Dialer Agent: ${dialerAgentUser} | API Submission`,
        communication_method: 'Phone',
        import_batch_id: 'api-submission',
      })
      .select('id')
      .single();

    if (bookingError) {
      console.error('Booking insert error:', bookingError);
      return new Response(JSON.stringify({ error: 'Failed to store record' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Insert audit record ---
    await adminClient.from('conversation_submissions').insert({
      audio_url: audioUrl,
      dialer_agent_user: dialerAgentUser,
      phone_number: phoneNumber,
      campaign,
      submission_type: type,
      matched_agent_id: agent.id,
      api_credential_id: credential.id,
      booking_id: booking.id,
    });

    // --- Audit log ---
    await adminClient.from('access_logs').insert({
      action: 'api_conversation_submitted',
      resource: `conversation_submissions:${booking.id}`,
      user_name: 'API: ' + clientId,
    });

    return new Response(JSON.stringify({
      success: true,
      bookingId: booking.id,
      matchedAgent: { id: agent.id, name: agent.name },
    }), {
      status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('submit-conversation-audio error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
