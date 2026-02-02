const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SendSMSRequest {
  bookingId: string;
  recipientPhone: string;
  recipientName: string;
  message: string;
}

// Format phone number to E.164 format for ClickSend
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it starts with 1 and has 11 digits, it's already US format
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it has 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it already has a +, return as-is
  if (phone.startsWith('+')) {
    return phone.replace(/[^\d+]/g, '');
  }
  
  // Return with + prefix
  return `+${digits}`;
}

// Validate phone number format
function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  // Accept 10-digit US numbers or 11-digit with country code
  return digits.length >= 10 && digits.length <= 15;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode JWT to get user ID
    const token = authHeader.replace('Bearer ', '');
    const payloadBase64 = token.split('.')[1];
    const payload = JSON.parse(atob(payloadBase64));
    const userId = payload.sub;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for permission checking
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.1');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user has permission to send communications
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('can_send_communications, name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile.can_send_communications) {
      return new Response(
        JSON.stringify({ error: 'You do not have permission to send communications. Contact your administrator.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: SendSMSRequest = await req.json();
    const { bookingId, recipientPhone, recipientName, message } = body;

    // Validate required fields
    if (!bookingId || !recipientPhone || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: bookingId, recipientPhone, message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone number format
    if (!isValidPhoneNumber(recipientPhone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format. Please use a valid US phone number.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate message length (max 1600 chars for concatenated SMS)
    if (message.length > 1600) {
      return new Response(
        JSON.stringify({ error: 'Message too long. Maximum 1600 characters allowed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get ClickSend credentials
    const clicksendUsername = Deno.env.get('CLICKSEND_USERNAME');
    const clicksendApiKey = Deno.env.get('CLICKSEND_API_KEY');

    if (!clicksendUsername || !clicksendApiKey) {
      console.error('ClickSend credentials not configured');
      return new Response(
        JSON.stringify({ error: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number for ClickSend
    const formattedPhone = formatPhoneNumber(recipientPhone);

    // Send SMS via ClickSend
    const clicksendResponse = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${clicksendUsername}:${clicksendApiKey}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            to: formattedPhone,
            from: 'PadSplit',
            body: message,
          },
        ],
      }),
    });

    const clicksendResult = await clicksendResponse.json();
    console.log('ClickSend response:', JSON.stringify(clicksendResult));

    // Check for ClickSend errors
    const messageResult = clicksendResult?.data?.messages?.[0];
    const status = messageResult?.status;

    if (!clicksendResponse.ok || (status && status !== 'SUCCESS')) {
      console.error('ClickSend error:', status, clicksendResult);
      
      // Map ClickSend status codes to user-friendly messages
      let errorMessage = 'Failed to send SMS. Please try again later.';
      if (status === 'INVALID_RECIPIENT') {
        errorMessage = 'Invalid phone number. Please verify the number is correct.';
      } else if (status === 'INSUFFICIENT_CREDIT') {
        errorMessage = 'SMS service temporarily unavailable. Please contact support.';
      } else if (status === 'INVALID_SENDER_ID') {
        errorMessage = 'SMS configuration error. Please contact support.';
      }

      // Log failed communication attempt
      await supabase.from('contact_communications').insert({
        booking_id: bookingId,
        user_id: userId,
        user_name: profile.name || 'Unknown',
        communication_type: 'sms',
        recipient_phone: recipientPhone,
        message_preview: message.substring(0, 100),
        status: 'failed',
      });

      return new Response(
        JSON.stringify({ error: errorMessage, clicksendStatus: status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful communication
    const { error: logError } = await supabase.from('contact_communications').insert({
      booking_id: bookingId,
      user_id: userId,
      user_name: profile.name || 'Unknown',
      communication_type: 'sms',
      recipient_phone: recipientPhone,
      message_preview: message.substring(0, 100),
      status: 'sent',
    });

    if (logError) {
      console.error('Failed to log communication:', logError);
      // Don't fail the request, SMS was sent successfully
    }

    console.log(`SMS sent successfully to ${formattedPhone} for booking ${bookingId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'SMS sent successfully',
        messageId: messageResult?.message_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
