import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ApiCredential {
  id: string;
  application_name: string;
  client_id: string;
  status: 'active' | 'revoked' | 'expired';
  rate_limit: number | null;
  last_used_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface CreateParams {
  application_name: string;
  expires_at?: string | null;
  rate_limit?: number | null;
}

export function useApiCredentials() {
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('manage-api-credentials', {
      body,
    });
    if (error) throw error;
    return data;
  }, []);

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_credentials')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCredentials((data as ApiCredential[]) || []);
    } catch (err) {
      toast({ title: 'Error loading credentials', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const createCredential = useCallback(async (params: CreateParams): Promise<{ credential: ApiCredential; client_secret: string }> => {
    const result = await invoke({ action: 'create', ...params });
    await fetchCredentials();
    return result;
  }, [invoke, fetchCredentials]);

  const revokeCredential = useCallback(async (id: string) => {
    await invoke({ action: 'revoke', id });
    await fetchCredentials();
    toast({ title: 'Credential revoked' });
  }, [invoke, fetchCredentials, toast]);

  const regenerateCredential = useCallback(async (id: string): Promise<{ credential: ApiCredential; client_secret: string }> => {
    const result = await invoke({ action: 'regenerate', id });
    await fetchCredentials();
    return result;
  }, [invoke, fetchCredentials]);

  const deleteCredential = useCallback(async (id: string) => {
    await invoke({ action: 'delete', id });
    await fetchCredentials();
    toast({ title: 'Credential deleted' });
  }, [invoke, fetchCredentials, toast]);

  return {
    credentials,
    loading,
    fetchCredentials,
    createCredential,
    revokeCredential,
    regenerateCredential,
    deleteCredential,
  };
}
