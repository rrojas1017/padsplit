import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse user agent to extract device info
function parseUserAgent(ua: string | null): { deviceType: string; os: string; browser: string } {
  if (!ua) return { deviceType: 'unknown', os: 'unknown', browser: 'unknown' };
  
  const uaLower = ua.toLowerCase();
  
  // Device type detection
  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(uaLower)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad|playbook|silk/i.test(uaLower)) {
    deviceType = 'tablet';
  } else if (/smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast/i.test(uaLower)) {
    deviceType = 'tv';
  }
  
  // OS detection
  let os = 'unknown';
  if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua) && !/android/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/chrome os/i.test(ua)) os = 'Chrome OS';
  
  // Browser detection
  let browser = 'unknown';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = 'Opera';
  else if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/msie|trident/i.test(ua)) browser = 'Internet Explorer';
  
  return { deviceType, os, browser };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, screenWidth, screenHeight, referrer, language, timezone } = await req.json();
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching wallboard data for token...');

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate the token first
    const { data: tokenData, error: tokenError } = await supabase
      .from('display_tokens')
      .select('id, name, site_filter, expires_at')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.log('Token not found or invalid');
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      console.log('Token expired');
      return new Response(
        JSON.stringify({ valid: false, error: 'Token expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Token validated, logging view and fetching data...');

    // Parse user agent for device info
    const userAgent = req.headers.get('user-agent') || null;
    const { deviceType, os, browser } = parseUserAgent(userAgent);
    
    // Get IP address
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('cf-connecting-ip') || 
                      req.headers.get('x-real-ip') || 
                      null;
    
    // Log the view with enhanced data - fire and forget
    supabase.from('display_token_views').insert({
      token_id: tokenData.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      device_type: deviceType,
      operating_system: os,
      browser: browser,
      screen_width: screenWidth || null,
      screen_height: screenHeight || null,
      referrer: referrer || null,
      language: language || null,
      timezone: timezone || null
    }).then(({ error }) => {
      if (error) {
        console.error('Error logging view:', error);
      } else {
        console.log(`View logged: ${deviceType} / ${os} / ${browser} / ${screenWidth}x${screenHeight}`);
      }
    });

    // Fetch all sites
    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('*');

    if (sitesError) {
      console.error('Error fetching sites:', sitesError);
      throw sitesError;
    }

    // Fetch all agents
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*');

    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
      throw agentsError;
    }

    // Fetch bookings - apply site filter if set
    let bookingsQuery = supabase
      .from('bookings')
      .select('*')
      .order('booking_date', { ascending: false });

    const { data: bookings, error: bookingsError } = await bookingsQuery;

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      throw bookingsError;
    }

    console.log(`Fetched ${bookings?.length || 0} bookings, ${agents?.length || 0} agents, ${sites?.length || 0} sites`);

    return new Response(
      JSON.stringify({
        valid: true,
        token: {
          id: tokenData.id,
          name: tokenData.name,
          siteFilter: tokenData.site_filter,
          expiresAt: tokenData.expires_at
        },
        bookings: bookings || [],
        agents: agents || [],
        sites: sites || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-wallboard-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
