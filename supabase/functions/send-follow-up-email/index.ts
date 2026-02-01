const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SendEmailRequest {
  bookingId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
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
    const body: SendEmailRequest = await req.json();
    const { bookingId, recipientEmail, recipientName, subject, htmlBody, textBody } = body;

    // Validate required fields
    if (!bookingId || !recipientEmail || !subject || !htmlBody) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: bookingId, recipientEmail, subject, htmlBody' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email via SendGrid
    const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY');
    if (!sendGridApiKey) {
      console.error('SENDGRID_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: recipientEmail, name: recipientName || undefined }],
            subject: subject,
          },
        ],
        from: {
          email: 'noreply@padsplit.tools',
          name: 'PadSplit',
        },
        content: [
          ...(textBody ? [{ type: 'text/plain', value: textBody }] : []),
          { type: 'text/html', value: htmlBody },
        ],
      }),
    });

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text();
      console.error('SendGrid error:', sendGridResponse.status, errorText);
      
      // Log failed communication attempt
      await supabase.from('contact_communications').insert({
        booking_id: bookingId,
        user_id: userId,
        user_name: profile.name || 'Unknown',
        communication_type: 'email',
        recipient_email: recipientEmail,
        message_preview: subject,
        status: 'failed',
      });

      return new Response(
        JSON.stringify({ error: 'Failed to send email. Please try again later.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful communication
    const { error: logError } = await supabase.from('contact_communications').insert({
      booking_id: bookingId,
      user_id: userId,
      user_name: profile.name || 'Unknown',
      communication_type: 'email',
      recipient_email: recipientEmail,
      message_preview: subject,
      status: 'sent',
    });

    if (logError) {
      console.error('Failed to log communication:', logError);
      // Don't fail the request, email was sent successfully
    }

    console.log(`Email sent successfully to ${recipientEmail} for booking ${bookingId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
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
