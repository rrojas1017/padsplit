import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// CIDR matching utility
function ipToBigInt(ip: string): bigint {
  // Handle IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number);
    return BigInt((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]);
  }
  // Handle IPv6 (simplified - expand to full form)
  const full = ip.split(':').map(part => part.padStart(4, '0')).join('');
  return BigInt('0x' + full);
}

function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    // Handle exact match (no CIDR notation)
    if (!cidr.includes('/')) {
      return ip === cidr;
    }

    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    
    // Determine if IPv4 or IPv6
    const isIPv4 = ip.includes('.');
    const isCidrIPv4 = range.includes('.');
    
    // Don't compare IPv4 with IPv6
    if (isIPv4 !== isCidrIPv4) {
      return false;
    }
    
    const ipBigInt = ipToBigInt(ip);
    const rangeBigInt = ipToBigInt(range);
    
    const maxBits = isIPv4 ? 32 : 128;
    const mask = (BigInt(1) << BigInt(maxBits - bits)) - BigInt(1);
    const inverseMask = ~mask;
    
    return (ipBigInt & inverseMask) === (rangeBigInt & inverseMask);
  } catch (error) {
    console.error('CIDR matching error:', error);
    return false;
  }
}

function extractClientIp(req: Request): string {
  // Try x-forwarded-for first (most common proxy header)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (client's original IP)
    return forwardedFor.split(',')[0].trim();
  }
  
  // Try x-real-ip
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  
  // Try cf-connecting-ip (Cloudflare)
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp.trim();
  }
  
  // Fallback - this won't work in edge functions but provides a default
  return '0.0.0.0';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create service role client for database queries
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Extract the JWT token from authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ blocked: false, message: 'No auth token, skipping IP check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Decode JWT to get user ID (without verification - Supabase handles this)
    const payloadBase64 = token.split('.')[1];
    const payload = JSON.parse(atob(payloadBase64));
    const userId = payload.sub;
    
    if (!userId) {
      console.error('No user ID in token');
      return new Response(
        JSON.stringify({ blocked: false, error: 'Invalid token format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get user's role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (roleError) {
      console.error('Error fetching user role:', roleError);
      return new Response(
        JSON.stringify({ blocked: false, error: 'Failed to fetch user role' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const userRole = roleData?.role || 'agent';
    
    // Non-agents are always allowed
    if (userRole !== 'agent') {
      console.log(`User ${userId} is ${userRole}, IP restriction bypassed`);
      return new Response(
        JSON.stringify({ blocked: false, role: userRole, message: 'IP restriction not applicable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get agent's site_id from profiles
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('site_id')
      .eq('id', userId)
      .maybeSingle();
    
    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return new Response(
        JSON.stringify({ blocked: false, error: 'Failed to fetch user profile' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const siteId = profileData?.site_id;
    
    // Get allowed IPs for the agent's site + global allowlist
    const { data: allowedIps, error: ipError } = await supabaseAdmin
      .from('ip_allowlists')
      .select('ip_address, description')
      .eq('is_active', true)
      .or(siteId ? `site_id.eq.${siteId},site_id.is.null` : 'site_id.is.null');
    
    if (ipError) {
      console.error('Error fetching IP allowlist:', ipError);
      return new Response(
        JSON.stringify({ blocked: false, error: 'Failed to fetch IP allowlist' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // If no IPs configured, allow login (prevents lockout)
    if (!allowedIps || allowedIps.length === 0) {
      console.log(`No IP allowlist configured for site ${siteId}, allowing login`);
      return new Response(
        JSON.stringify({ blocked: false, message: 'No IP restrictions configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Extract client IP
    const clientIp = extractClientIp(req);
    console.log(`Checking IP ${clientIp} for user ${userId} (site: ${siteId})`);
    
    // Check if client IP matches any allowed IP/CIDR
    let isAllowed = false;
    let matchedEntry: { ip_address: string; description: string | null } | null = null;
    
    for (const entry of allowedIps) {
      if (isIpInCidr(clientIp, entry.ip_address)) {
        isAllowed = true;
        matchedEntry = entry;
        break;
      }
    }
    
    if (isAllowed) {
      console.log(`IP ${clientIp} allowed via entry: ${matchedEntry?.description || matchedEntry?.ip_address}`);
      return new Response(
        JSON.stringify({ 
          blocked: false, 
          clientIp,
          matchedRule: matchedEntry?.description || matchedEntry?.ip_address
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // IP not allowed - log the blocked attempt
    console.warn(`BLOCKED: IP ${clientIp} not in allowlist for user ${userId}`);
    
    // Log to access_logs
    await supabaseAdmin
      .from('access_logs')
      .insert({
        user_id: userId,
        action: 'blocked_login_ip',
        ip_address: clientIp,
        resource: `Site: ${siteId || 'unknown'}`,
      });
    
    return new Response(
      JSON.stringify({ 
        blocked: true,
        clientIp,
        message: 'Login not allowed from this location. Please contact your supervisor.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in validate-login-ip:', error);
    return new Response(
      JSON.stringify({ blocked: false, error: 'Internal error during IP validation' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
