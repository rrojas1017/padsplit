import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DisplayToken } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface DisplayTokensContextType {
  tokens: DisplayToken[];
  isLoading: boolean;
  addToken: (token: Omit<DisplayToken, 'id' | 'token' | 'createdAt'>) => Promise<DisplayToken>;
  deleteToken: (id: string) => Promise<void>;
  validateToken: (token: string) => Promise<DisplayToken | null>;
}

const DisplayTokensContext = createContext<DisplayTokensContextType | undefined>(undefined);

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function DisplayTokensProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<DisplayToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('display_tokens')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tokens:', error);
        return;
      }

      const transformedTokens: DisplayToken[] = (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        token: t.token,
        createdAt: new Date(t.created_at),
        expiresAt: t.expires_at ? new Date(t.expires_at) : undefined,
        siteFilter: t.site_filter || undefined,
      }));

      setTokens(transformedTokens);
    } catch (error) {
      console.error('Error fetching tokens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const addToken = async (tokenData: Omit<DisplayToken, 'id' | 'token' | 'createdAt'>): Promise<DisplayToken> => {
    const { data: userData } = await supabase.auth.getUser();
    const newTokenString = generateToken();
    
    const { data, error } = await supabase
      .from('display_tokens')
      .insert({
        name: tokenData.name,
        token: newTokenString,
        site_filter: tokenData.siteFilter || null,
        expires_at: tokenData.expiresAt?.toISOString() || null,
        created_by: userData.user?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding token:', error);
      throw error;
    }

    const newToken: DisplayToken = {
      id: data.id,
      name: data.name,
      token: data.token,
      createdAt: new Date(data.created_at),
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      siteFilter: data.site_filter || undefined,
    };

    await fetchTokens();
    return newToken;
  };

  const deleteToken = async (id: string) => {
    const { error } = await supabase.from('display_tokens').delete().eq('id', id);

    if (error) {
      console.error('Error deleting token:', error);
      throw error;
    }

    await fetchTokens();
  };

  const validateToken = async (tokenString: string): Promise<DisplayToken | null> => {
    try {
      // Use edge function to validate token securely (server-side)
      const { data, error } = await supabase.functions.invoke('validate-display-token', {
        body: { token: tokenString }
      });

      if (error) {
        console.error('Error validating token:', error);
        return null;
      }

      if (!data?.valid || !data?.data) {
        return null;
      }

      return {
        id: data.data.id,
        name: data.data.name,
        token: tokenString, // Keep the token for reference (user already has it in URL)
        createdAt: new Date(), // Not returned from edge function, use current date
        expiresAt: data.data.expiresAt ? new Date(data.data.expiresAt) : undefined,
        siteFilter: data.data.siteFilter || undefined,
      };
    } catch (error) {
      console.error('Error validating token:', error);
      return null;
    }
  };

  return (
    <DisplayTokensContext.Provider value={{ tokens, isLoading, addToken, deleteToken, validateToken }}>
      {children}
    </DisplayTokensContext.Provider>
  );
}

export function useDisplayTokens() {
  const context = useContext(DisplayTokensContext);
  if (!context) {
    throw new Error('useDisplayTokens must be used within a DisplayTokensProvider');
  }
  return context;
}
