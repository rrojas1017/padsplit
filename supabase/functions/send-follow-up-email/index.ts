import { requireUser, STAFF, adminClient, canSeeBooking, corsHeaders } from '../_shared/auth.ts';

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
    const auth = await requireUser(req, STAFF);
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;
    const perms = auth.ctx.profile;

    if (!(perms?.can_send_communications === true && perms?.can_send_email === true)) {
      return new Response(
        JSON.stringify({ error: 'You do not have permission to send communications. Contact your administrator.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = adminClient();
    const { data: nameRow } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
    const profile = { name: (nameRow as { name?: string } | null)?.name ?? null };

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

    if (!(await canSeeBooking(auth.ctx, bookingId))) {
      return new Response(JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: booking } = await supabase.from('bookings').select('contact_email, contact_phone').eq('id', bookingId).maybeSingle();
    if (!booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (recipientEmail.trim().toLowerCase() !== (booking.contact_email ?? '').trim().toLowerCase() || !booking.contact_email) {
      return new Response(JSON.stringify({ error: 'Recipient does not match the booking contact' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
