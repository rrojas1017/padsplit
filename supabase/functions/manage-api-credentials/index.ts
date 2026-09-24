import { requireUser, ADMINS, adminClient, corsHeaders } from '../_shared/auth.ts';

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

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req, ADMINS);
  if (!auth.ok) return auth.response;
  const userId = auth.ctx.userId;

  try {
    const db = adminClient();
    const body = await req.json();
    const { action } = body;

    const logAction = async (logActionName: string, resource: string) => {
      await db.from('access_logs').insert({ action: logActionName, user_id: userId, resource });
    };

    if (action === 'create') {
      const { application_name, expires_at, rate_limit } = body;
      if (!application_name?.trim()) return json(400, { error: 'application_name is required' });

      const clientId = generateSecureToken('app_');
      const clientSecret = generateSecureToken('sk_');
      const secretHash = await sha256Hex(clientSecret);

      const { data: credential, error } = await db
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
      return json(200, { credential: { ...credential, client_secret_hash: undefined }, client_secret: clientSecret });
    }

    if (action === 'revoke') {
      const { id } = body;
      const { data, error } = await db
        .from('api_credentials')
        .update({ status: 'revoked' })
        .eq('id', id)
        .is('deleted_at', null)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) return json(404, { error: 'Credential not found' });
      await logAction('api_credential_revoked', `api_credentials:${id}`);
      return json(200, { success: true });
    }

    if (action === 'regenerate') {
      const { id } = body;
      const clientSecret = generateSecureToken('sk_');
      const secretHash = await sha256Hex(clientSecret);

      const { data, error } = await db
        .from('api_credentials')
        .update({ client_secret_hash: secretHash })
        .eq('id', id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) return json(404, { error: 'Credential not found or not active' });
      await logAction('api_credential_regenerated', `api_credentials:${id}`);
      return json(200, { credential: { ...data[0], client_secret_hash: undefined }, client_secret: clientSecret });
    }

    if (action === 'delete') {
      const { id } = body;
      const { data, error } = await db
        .from('api_credentials')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .is('deleted_at', null)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) return json(404, { error: 'Credential not found' });
      await logAction('api_credential_deleted', `api_credentials:${id}`);
      return json(200, { success: true });
    }

    return json(400, { error: 'Unknown action' });
  } catch (err) {
    console.error('manage-api-credentials error:', err instanceof Error ? err.message : 'unknown');
    return json(500, { error: 'Internal server error' });
  }
});
