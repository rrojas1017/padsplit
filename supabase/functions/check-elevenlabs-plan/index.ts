import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    // Call ElevenLabs user info API
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const userData = await response.json();
    
    // Log full subscription details for debugging
    console.log('ElevenLabs User Data:', JSON.stringify(userData, null, 2));
    console.log('Subscription Tier:', userData.subscription?.tier);
    console.log('Character Count:', userData.subscription?.character_count);
    console.log('Character Limit:', userData.subscription?.character_limit);

    return new Response(JSON.stringify({
      success: true,
      subscription: {
        tier: userData.subscription?.tier,
        status: userData.subscription?.status,
        character_count: userData.subscription?.character_count,
        character_limit: userData.subscription?.character_limit,
        next_character_count_reset_unix: userData.subscription?.next_character_count_reset_unix,
        billing_period: userData.subscription?.billing_period,
      },
      user: {
        email: userData.email,
        first_name: userData.first_name,
      },
      pricing_note: userData.subscription?.tier === 'pro' 
        ? '✅ Pro Plan confirmed: Using $0.034/min STT and $0.00015/char TTS rates'
        : '⚠️ Not on Pro Plan: May need to adjust pricing rates'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error checking ElevenLabs plan:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
