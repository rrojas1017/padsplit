import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validating script token...');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch the token row
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from('script_access_tokens')
      .select('id, script_id, is_active, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (tokenError) {
      console.error('DB error fetching token:', tokenError);
      return new Response(
        JSON.stringify({ valid: false, error: 'Validation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokenRow) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokenRow.is_active) {
      return new Response(
        JSON.stringify({ valid: false, error: 'This link has been revoked' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tokenRow.expires_at && new Date() > new Date(tokenRow.expires_at)) {
      return new Response(
        JSON.stringify({ valid: false, error: 'This link has expired' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the script
    const { data: script, error: scriptError } = await supabaseAdmin
      .from('research_scripts')
      .select('id, name, description, campaign_type, target_audience, questions, intro_script, rebuttal_script, closing_script, is_active')
      .eq('id', tokenRow.script_id)
      .maybeSingle();

    if (scriptError || !script) {
      console.error('DB error fetching script:', scriptError);
      return new Response(
        JSON.stringify({ valid: false, error: 'Script not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_accessed_at (fire and forget)
    supabaseAdmin
      .from('script_access_tokens')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', tokenRow.id)
      .then(() => {});

    console.log('Script token validated successfully for script:', script.name);

    return new Response(
      JSON.stringify({
        valid: true,
        script: {
          id: script.id,
          name: script.name,
          description: script.description,
          campaign_type: script.campaign_type,
          target_audience: script.target_audience,
          questions: script.questions,
          intro_script: script.intro_script,
          rebuttal_script: script.rebuttal_script,
          closing_script: script.closing_script,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in validate-script-token:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
