import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ScriptToken {
  id: string;
  script_id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  last_accessed_at: string | null;
}

const BASE_URL = 'https://padsplit.lovable.app';

export function getScriptPublicUrl(token: string) {
  return `${BASE_URL}/script/${token}`;
}

export function useScriptTokens(scriptIds: string[]) {
  const [tokens, setTokens] = useState<Record<string, ScriptToken>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchTokens = useCallback(async () => {
    if (!scriptIds.length) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('script_access_tokens' as any)
      .select('*')
      .in('script_id', scriptIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Keep only the most recent active token per script
      const map: Record<string, ScriptToken> = {};
      for (const row of (data as unknown) as ScriptToken[]) {
        if (!map[row.script_id]) {
          map[row.script_id] = row;
        }
      }
      setTokens(map);
    }
    setIsLoading(false);
  }, [scriptIds.join(',')]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const generateToken = useCallback(async (scriptId: string, label?: string): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('script_access_tokens' as any)
      .insert({
        script_id: scriptId,
        label: label || 'External Link',
        created_by: user?.id || null,
      })
      .select('*')
      .single();

    if (error) {
      toast.error('Failed to generate link');
      return null;
    }

    const newToken = (data as unknown) as ScriptToken;
    setTokens(prev => ({ ...prev, [scriptId]: newToken }));
    const url = getScriptPublicUrl(newToken.token);
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success('Public link generated and copied to clipboard!');
    return url;
  }, []);

  const copyToken = useCallback(async (token: ScriptToken) => {
    const url = getScriptPublicUrl(token.token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  }, []);

  const revokeToken = useCallback(async (tokenId: string, scriptId: string) => {
    const { error } = await supabase
      .from('script_access_tokens' as any)
      .update({ is_active: false })
      .eq('id', tokenId);

    if (error) {
      toast.error('Failed to revoke link');
      return;
    }

    setTokens(prev => {
      const next = { ...prev };
      delete next[scriptId];
      return next;
    });
    toast.success('Public link revoked');
  }, []);

  const regenerateToken = useCallback(async (scriptId: string): Promise<string | null> => {
    const existing = tokens[scriptId];
    if (existing) {
      await supabase
        .from('script_access_tokens' as any)
        .update({ is_active: false })
        .eq('id', existing.id);
    }
    return generateToken(scriptId, 'External Link');
  }, [tokens, generateToken]);

  return { tokens, isLoading, generateToken, copyToken, revokeToken, regenerateToken, refetch: fetchTokens };
}
