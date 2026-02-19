import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSecureToken(prefix: string, length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}${hex}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user via anon client
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    // Use service role for all DB ops
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify role
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (!roleData || !['super_admin', 'admin'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient role' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Helper to log to access_logs
    const logAction = async (logActionName: string, resource: string) => {
      await adminClient.from('access_logs').insert({
        action: logActionName,
        user_id: userId,
        resource,
      });
    };

    if (action === 'create') {
      const { application_name, expires_at, rate_limit } = body;
      if (!application_name?.trim()) {
        return new Response(JSON.stringify({ error: 'application_name is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clientId = generateSecureToken('app_');
      const clientSecret = generateSecureToken('sk_');
      const secretHash = await sha256Hex(clientSecret);

      const { data: credential, error } = await adminClient
        .from('api_credentials')
        .insert({
          application_name: application_name.trim(),
          client_id: clientId,
          client_secret_hash: secretHash,
          status: 'active',
          expires_at: expires_at || null,
          rate_limit: rate_limit || null,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      await logAction('api_credential_created', `api_credentials:${credential.id}`);

      return new Response(JSON.stringify({
        credential: { ...credential, client_secret_hash: undefined },
        client_secret: clientSecret,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'revoke') {
      const { id } = body;
      const { error } = await adminClient
        .from('api_credentials')
        .update({ status: 'revoked' })
        .eq('id', id);
      if (error) throw error;
      await logAction('api_credential_revoked', `api_credentials:${id}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'regenerate') {
      const { id } = body;
      const clientSecret = generateSecureToken('sk_');
      const secretHash = await sha256Hex(clientSecret);

      const { data: credential, error } = await adminClient
        .from('api_credentials')
        .update({ client_secret_hash: secretHash, status: 'active' })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      await logAction('api_credential_regenerated', `api_credentials:${id}`);
      return new Response(JSON.stringify({
        credential: { ...credential, client_secret_hash: undefined },
        client_secret: clientSecret,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete') {
      const { id } = body;
      const { error } = await adminClient
        .from('api_credentials')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await logAction('api_credential_deleted', `api_credentials:${id}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('manage-api-credentials error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
