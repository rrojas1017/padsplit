import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      console.log('Validation failed: Missing or invalid token parameter');
      return new Response(
        JSON.stringify({ valid: false, error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validating display token...');

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Query the token - only return what's needed, never expose the raw token
    const { data, error } = await supabaseAdmin
      .from('display_tokens')
      .select('id, name, expires_at, site_filter')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      console.error('Database error during token validation:', error);
      return new Response(
        JSON.stringify({ valid: false, error: 'Validation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data) {
      console.log('Token not found');
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (data.expires_at && new Date() > new Date(data.expires_at)) {
      console.log('Token expired');
      return new Response(
        JSON.stringify({ valid: false, error: 'Token expired' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Token validated successfully:', data.name);

    // Return only safe, non-sensitive data
    return new Response(
      JSON.stringify({
        valid: true,
        data: {
          id: data.id,
          name: data.name,
          siteFilter: data.site_filter || undefined,
          expiresAt: data.expires_at || undefined,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in validate-display-token:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
