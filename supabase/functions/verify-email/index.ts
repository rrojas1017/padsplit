import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyEmailRequest {
  bookingId: string;
  email: string;
}

// EmailListVerify can return either plain text or JSON depending on the endpoint
interface EmailListVerifyResponse {
  email?: string;
  did_you_mean?: string;
  user?: string;
  domain?: string;
  syntax_valid?: boolean;
  is_disposable?: boolean | null;
  is_role_account?: boolean | null;
  is_catch_all?: boolean | null;
  is_deliverable?: boolean | null;
  can_connect_smtp?: boolean | null;
  is_inbox_full?: string;
  is_disabled?: string;
  mx_records?: boolean | null;
  free?: boolean | null;
  score?: number | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { bookingId, email }: VerifyEmailRequest = await req.json();

    // Validate input
    if (!bookingId || !email) {
      console.error('Missing required fields:', { bookingId: !!bookingId, email: !!email });
      return new Response(
        JSON.stringify({ error: 'bookingId and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying email for booking ${bookingId}: ${email}`);

    // Get EmailListVerify API key
    const apiKey = Deno.env.get('EMAILLISTVERIFY_API_KEY');
    if (!apiKey) {
      console.error('EMAILLISTVERIFY_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email verification service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call EmailListVerify API
    let verificationResult: {
      verified: boolean;
      status: string;
    };

    try {
      const apiResponse = await fetch(
        `https://apps.emaillistverify.com/api/verifyEmail?secret=${apiKey}&email=${encodeURIComponent(email)}`,
        { method: 'GET' }
      );

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error('EmailListVerify error:', apiResponse.status, errorText);
        verificationResult = { verified: false, status: 'unknown' };
      } else {
        const responseText = await apiResponse.text();
        console.log('EmailListVerify response:', responseText);

        // Try to parse as JSON first (some endpoints return JSON)
        try {
          const jsonResponse: EmailListVerifyResponse = JSON.parse(responseText);
          
          // Handle JSON response format
          if (jsonResponse.is_deliverable === false || jsonResponse.is_disabled === 'true') {
            verificationResult = { verified: false, status: 'invalid' };
          } else if (jsonResponse.is_disposable === true) {
            verificationResult = { verified: false, status: 'disposable' };
          } else if (jsonResponse.is_catch_all === true) {
            verificationResult = { verified: true, status: 'catch_all' };
          } else if (jsonResponse.is_deliverable === true && jsonResponse.can_connect_smtp === true) {
            verificationResult = { verified: true, status: 'valid' };
          } else if (jsonResponse.syntax_valid === true && jsonResponse.mx_records === true) {
            // Has valid format and MX records
            verificationResult = { verified: true, status: 'valid' };
          } else if (jsonResponse.syntax_valid === false) {
            verificationResult = { verified: false, status: 'invalid' };
          } else if (jsonResponse.syntax_valid === true && jsonResponse.is_deliverable === null) {
            // Syntax valid but couldn't determine deliverability - treat as unknown
            verificationResult = { verified: false, status: 'unknown' };
          } else {
            verificationResult = { verified: false, status: 'unknown' };
          }
        } catch {
          // Handle plain text response format
          const normalizedResponse = responseText.trim().toLowerCase();
          
          switch (normalizedResponse) {
            case 'ok':
              verificationResult = { verified: true, status: 'valid' };
              break;
            case 'failed':
              verificationResult = { verified: false, status: 'invalid' };
              break;
            case 'unknown':
              verificationResult = { verified: false, status: 'unknown' };
              break;
            case 'incorrect':
              verificationResult = { verified: false, status: 'invalid' };
              break;
            case 'key_not_valid':
              console.error('EmailListVerify API key is invalid');
              verificationResult = { verified: false, status: 'unknown' };
              break;
            case 'missing parameters':
              console.error('EmailListVerify missing parameters');
              verificationResult = { verified: false, status: 'unknown' };
              break;
            default:
              console.log('Unknown EmailListVerify response:', normalizedResponse);
              verificationResult = { verified: false, status: 'unknown' };
          }
        }
      }
    } catch (apiError) {
      console.error('Error calling EmailListVerify:', apiError);
      verificationResult = { verified: false, status: 'unknown' };
    }

    console.log(`Verification result for ${email}:`, verificationResult);

    // Update booking with verification results
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        email_verified: verificationResult.verified,
        email_verified_at: new Date().toISOString(),
        email_verification_status: verificationResult.status,
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save verification result', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully updated booking ${bookingId} with email verification`);

    return new Response(
      JSON.stringify({
        success: true,
        bookingId,
        email,
        verified: verificationResult.verified,
        status: verificationResult.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in verify-email:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
