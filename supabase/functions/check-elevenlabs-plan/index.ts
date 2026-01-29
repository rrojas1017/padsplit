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

    // Try /v1/user endpoint first (works for personal keys)
    console.log('Attempting /v1/user endpoint...');
    const userResponse = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    if (userResponse.ok) {
      // Personal key - full access to user info
      const userData = await userResponse.json();
      console.log('Personal key detected - full user info available');
      console.log('Subscription Tier:', userData.subscription?.tier);
      
      return new Response(JSON.stringify({
        success: true,
        key_type: 'personal',
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
    }

    // If /v1/user returns 401, try fallback to /v1/voices (works for workspace/service keys)
    if (userResponse.status === 401) {
      console.log('/v1/user returned 401 - trying fallback to /v1/voices...');
      
      const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      });

      if (voicesResponse.ok) {
        const voicesData = await voicesResponse.json();
        const voiceCount = voicesData.voices?.length || 0;
        
        console.log('Workspace/Service Account key detected - voices endpoint accessible');
        console.log('Available voices:', voiceCount);

        return new Response(JSON.stringify({
          success: true,
          key_type: 'workspace_or_service_account',
          message: 'API key is valid (Workspace or Service Account key detected)',
          voices_available: voiceCount,
          note: 'Workspace/Service Account keys cannot access /v1/user endpoint, but TTS and STT functionality will work normally.',
          pricing_note: '⚠️ Unable to verify subscription tier with this key type. Ensure your account has the expected plan for accurate cost calculations.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Both endpoints failed
      const voicesError = await voicesResponse.text();
      console.error('Both endpoints failed. /v1/voices error:', voicesError);
      
      throw new Error(`API key validation failed. /v1/user: 401, /v1/voices: ${voicesResponse.status}`);
    }

    // /v1/user returned a non-401 error
    const errorText = await userResponse.text();
    throw new Error(`ElevenLabs API error: ${userResponse.status} - ${errorText}`);

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
