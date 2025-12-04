import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DisplayToken } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface DisplayTokenWithStats extends DisplayToken {
  viewCount: number;
  lastViewedAt: Date | null;
  createdByName: string | null;
  createdByEmail: string | null;
}

interface DisplayTokensContextType {
  tokens: DisplayTokenWithStats[];
  isLoading: boolean;
  addToken: (token: Omit<DisplayToken, 'id' | 'token' | 'createdAt'>) => Promise<DisplayToken>;
  deleteToken: (id: string) => Promise<void>;
  validateToken: (token: string) => Promise<DisplayToken | null>;
  refreshTokens: () => Promise<void>;
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
  const [tokens, setTokens] = useState<DisplayTokenWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTokens = async () => {
    try {
      // Fetch tokens with creator profile info
      const { data: tokensData, error: tokensError } = await supabase
        .from('display_tokens')
        .select(`
          *,
          profiles:created_by (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (tokensError) {
        console.error('Error fetching tokens:', tokensError);
        return;
      }

      // Fetch view stats for all tokens
      const { data: viewStats, error: viewsError } = await supabase
        .from('display_token_views')
        .select('token_id, viewed_at');

      if (viewsError) {
        console.error('Error fetching view stats:', viewsError);
      }

      // Aggregate view stats per token
      const viewStatsMap = new Map<string, { count: number; lastViewed: Date | null }>();
      if (viewStats) {
        for (const view of viewStats) {
          const existing = viewStatsMap.get(view.token_id);
          const viewedAt = new Date(view.viewed_at);
          if (existing) {
            existing.count++;
            if (!existing.lastViewed || viewedAt > existing.lastViewed) {
              existing.lastViewed = viewedAt;
            }
          } else {
            viewStatsMap.set(view.token_id, { count: 1, lastViewed: viewedAt });
          }
        }
      }

      const transformedTokens: DisplayTokenWithStats[] = (tokensData || []).map((t: any) => {
        const stats = viewStatsMap.get(t.id) || { count: 0, lastViewed: null };
        return {
          id: t.id,
          name: t.name,
          token: t.token,
          createdAt: new Date(t.created_at),
          expiresAt: t.expires_at ? new Date(t.expires_at) : undefined,
          siteFilter: t.site_filter || undefined,
          viewCount: stats.count,
          lastViewedAt: stats.lastViewed,
          createdByName: t.profiles?.name || null,
          createdByEmail: t.profiles?.email || null,
        };
      });

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

  const refreshTokens = async () => {
    await fetchTokens();
  };

  return (
    <DisplayTokensContext.Provider value={{ tokens, isLoading, addToken, deleteToken, validateToken, refreshTokens }}>
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