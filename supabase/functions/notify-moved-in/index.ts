import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return new Response(JSON.stringify({ error: 'bookingId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Read recipient email from notification_settings table (configurable via UI)
    const { data: setting, error: settingError } = await supabase
      .from('notification_settings')
      .select('value')
      .eq('key', 'moved_in_notification_email')
      .single();

    const recipientEmail = setting?.value?.trim();

    if (!recipientEmail) {
      console.error('[notify-moved-in] No recipient email configured in notification_settings');
      return new Response(JSON.stringify({ error: 'Notification email not configured. Please set it in Settings → Security.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch booking + agent name via join
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        member_name,
        contact_email,
        contact_phone,
        booking_date,
        move_in_date,
        market_city,
        market_state,
        communication_method,
        agents (
          name
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('[notify-moved-in] Failed to fetch booking:', bookingError);
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const agentName = (booking.agents as { name: string } | null)?.name ?? 'Unknown';
    const market = [booking.market_city, booking.market_state].filter(Boolean).join(', ') || 'N/A';

    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return 'N/A';
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const subject = `[Moved In] ${booking.member_name} — ${market}`;

    const rows = [
      { label: 'Member Name', value: booking.member_name ?? 'N/A' },
      { label: 'Contact Email', value: booking.contact_email ?? 'N/A' },
      { label: 'Contact Phone', value: booking.contact_phone ?? 'N/A' },
      { label: 'Agent', value: agentName },
      { label: 'Market', value: market },
      { label: 'Booking Date', value: formatDate(booking.booking_date) },
      { label: 'Move-In Date', value: formatDate(booking.move_in_date) },
      { label: 'Communication', value: booking.communication_method ?? 'N/A' },
    ];

    const tableRows = rows
      .map(
        ({ label, value }) => `
      <tr>
        <td style="padding:8px 16px 8px 0;color:#6b7280;font-size:14px;white-space:nowrap;vertical-align:top;">${label}</td>
        <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:500;">${value}</td>
      </tr>`
      )
      .join('');

    const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#16a34a;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Move-In Notification</p>
            <h1 style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:700;">${booking.member_name ?? 'Member'} — Moved In</h1>
            <p style="margin:4px 0 0;color:#bbf7d0;font-size:14px;">${market}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <table cellpadding="0" cellspacing="0" width="100%">
              ${tableRows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">This notification was sent automatically when the booking status changed to <strong>Moved In</strong>.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const textBody = rows.map(({ label, value }) => `${label}: ${value}`).join('\n');

    const sendgridRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipientEmail }] }],
        from: { email: 'noreply@padsplit.tools', name: 'PadSplit Ops' },
        subject,
        content: [
          { type: 'text/plain', value: textBody },
          { type: 'text/html', value: htmlBody },
        ],
      }),
    });

    if (!sendgridRes.ok) {
      const errBody = await sendgridRes.text();
      console.error('[notify-moved-in] SendGrid error:', sendgridRes.status, errBody);
      return new Response(JSON.stringify({ error: 'Failed to send email', detail: errBody }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[notify-moved-in] Email sent for booking ${bookingId} → ${recipientEmail}`);

    // --- Post lead to Coverall CRM ---
    let coverallResult: { success: boolean; leadId?: number; error?: string } = { success: false };
    const coverallToken = Deno.env.get('COVERALL_API_TOKEN');

    if (coverallToken) {
      try {
        // Format phone: strip non-digits, take last 10
        const rawPhone = booking.contact_phone ?? '';
        const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);

        if (cleanPhone.length === 10) {
          const coverallParams = new URLSearchParams();
          coverallParams.append('source', 'PadSplit');
          coverallParams.append('status', '2');
          coverallParams.append('name', booking.member_name ?? 'Unknown');
          coverallParams.append('phonenumber', cleanPhone);
          if (booking.contact_email) coverallParams.append('email', booking.contact_email);
          if (booking.market_city) coverallParams.append('city', booking.market_city);
          if (booking.market_state) coverallParams.append('state', booking.market_state);
          coverallParams.append('description', `Moved In on ${formatDate(booking.move_in_date)}. Agent: ${agentName}. Communication: ${booking.communication_method ?? 'N/A'}.`);

          const coverallRes = await fetch('https://app.coverallhc.com/api/leads', {
            method: 'POST',
            headers: {
              'authtoken': coverallToken,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: coverallParams.toString(),
          });

          const coverallData = await coverallRes.json();
          console.log('[notify-moved-in] Coverall CRM response:', JSON.stringify(coverallData));

          if (coverallData.status === true) {
            coverallResult = { success: true, leadId: coverallData.leadid };
          } else {
            coverallResult = { success: false, error: coverallData.message || 'Unknown error' };
          }
        } else {
          coverallResult = { success: false, error: `Invalid phone number: "${rawPhone}" (must be 10 digits)` };
          console.warn('[notify-moved-in] Skipped Coverall CRM: invalid phone number');
        }
      } catch (coverallErr) {
        console.error('[notify-moved-in] Coverall CRM error:', coverallErr);
        coverallResult = { success: false, error: String(coverallErr) };
      }
    } else {
      console.warn('[notify-moved-in] COVERALL_API_TOKEN not configured, skipping CRM post');
      coverallResult = { success: false, error: 'COVERALL_API_TOKEN not configured' };
    }

    return new Response(JSON.stringify({ success: true, bookingId, coverall: coverallResult }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[notify-moved-in] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
