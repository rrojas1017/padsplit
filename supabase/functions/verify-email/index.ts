import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyEmailRequest {
  bookingId: string;
  email: string;
}

interface APILayerResponse {
  email: string;
  format_valid: boolean;
  mx_found: boolean;
  smtp_check: boolean;
  catch_all: boolean | null;
  role: boolean;
  disposable: boolean;
  score: number;
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

    // Get APILayer API key
    const apiKey = Deno.env.get('APILAYER_API_KEY');
    if (!apiKey) {
      console.error('APILAYER_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email verification service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call APILayer email verification API
    let verificationResult: {
      verified: boolean;
      status: string;
    };

    try {
      const apiResponse = await fetch(
        `https://api.apilayer.com/email_verification/${encodeURIComponent(email)}`,
        {
          method: 'GET',
          headers: {
            'apikey': apiKey,
          },
        }
      );

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error('APILayer error:', apiResponse.status, errorText);
        verificationResult = { verified: false, status: 'unknown' };
      } else {
        const data: APILayerResponse = await apiResponse.json();
        console.log('APILayer response:', JSON.stringify(data));

        // Determine verification status
        if (!data.format_valid) {
          verificationResult = { verified: false, status: 'invalid' };
        } else if (data.disposable) {
          verificationResult = { verified: false, status: 'disposable' };
        } else if (data.catch_all) {
          verificationResult = { verified: true, status: 'catch_all' };
        } else if (data.smtp_check && data.format_valid) {
          verificationResult = { verified: true, status: 'valid' };
        } else {
          verificationResult = { verified: false, status: 'invalid' };
        }
      }
    } catch (apiError) {
      console.error('Error calling APILayer:', apiError);
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
