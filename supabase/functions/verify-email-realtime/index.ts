import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EmailListVerifyResponse {
  is_deliverable?: boolean;
  is_disposable?: boolean;
  is_catch_all?: boolean;
  syntax_valid?: boolean;
  failed?: boolean;
}

type VerificationStatus = 'valid' | 'invalid' | 'disposable' | 'catch_all' | 'unknown';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required', verified: false, status: 'unknown' as VerificationStatus }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({ verified: false, status: 'invalid' as VerificationStatus }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('EMAILLISTVERIFY_API_KEY');
    if (!apiKey) {
      console.error('EMAILLISTVERIFY_API_KEY not configured');
      return new Response(
        JSON.stringify({ verified: false, status: 'unknown' as VerificationStatus }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[verify-email-realtime] Verifying: ${email}`);

    const apiResponse = await fetch(
      `https://apps.emaillistverify.com/api/verifyEmail?secret=${apiKey}&email=${encodeURIComponent(email.trim())}`
    );

    if (!apiResponse.ok) {
      console.error(`EmailListVerify API error: ${apiResponse.status}`);
      return new Response(
        JSON.stringify({ verified: false, status: 'unknown' as VerificationStatus }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseText = await apiResponse.text();
    console.log(`[verify-email-realtime] Response: ${responseText}`);

    let verificationStatus: VerificationStatus = 'unknown';
    let verified = false;

    // Try parsing as JSON first
    try {
      const jsonResponse: EmailListVerifyResponse = JSON.parse(responseText);
      
      if (jsonResponse.is_disposable) {
        verificationStatus = 'disposable';
        verified = false;
      } else if (jsonResponse.is_catch_all) {
        verificationStatus = 'catch_all';
        verified = true;
      } else if (jsonResponse.is_deliverable) {
        verificationStatus = 'valid';
        verified = true;
      } else if (jsonResponse.failed || jsonResponse.syntax_valid === false) {
        verificationStatus = 'invalid';
        verified = false;
      }
    } catch {
      // Plain text response
      const result = responseText.trim().toLowerCase();
      
      switch (result) {
        case 'ok':
          verificationStatus = 'valid';
          verified = true;
          break;
        case 'fail':
        case 'failed':
        case 'incorrect':
        case 'invalid':
          verificationStatus = 'invalid';
          verified = false;
          break;
        case 'disposable':
          verificationStatus = 'disposable';
          verified = false;
          break;
        case 'catch_all':
        case 'catchall':
          verificationStatus = 'catch_all';
          verified = true;
          break;
        case 'unknown':
        default:
          verificationStatus = 'unknown';
          verified = false;
          break;
      }
    }

    console.log(`[verify-email-realtime] Result: ${verificationStatus}, verified: ${verified}`);

    return new Response(
      JSON.stringify({ verified, status: verificationStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[verify-email-realtime] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Verification failed', verified: false, status: 'unknown' as VerificationStatus }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
