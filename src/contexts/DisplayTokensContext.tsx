import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DisplayToken } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface ViewRecord {
  id: string;
  token_id: string;
  viewed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  operating_system: string | null;
  browser: string | null;
  screen_width: number | null;
  screen_height: number | null;
  referrer: string | null;
  language: string | null;
  timezone: string | null;
}

interface DeviceStats {
  desktop: number;
  mobile: number;
  tablet: number;
  tv: number;
  unknown: number;
}

interface BrowserStats {
  [browser: string]: number;
}

interface ScreenResolution {
  resolution: string;
  count: number;
}

interface DisplayTokenWithStats extends DisplayToken {
  viewCount: number;
  uniqueViewers: number;
  lastViewedAt: Date | null;
  createdByName: string | null;
  createdByEmail: string | null;
  primaryDevice: string;
  deviceStats: DeviceStats;
  browserStats: BrowserStats;
  topResolutions: ScreenResolution[];
  recentViews: ViewRecord[];
}

interface DisplayTokensContextType {
  tokens: DisplayTokenWithStats[];
  isLoading: boolean;
  addToken: (token: Omit<DisplayToken, 'id' | 'token' | 'createdAt'>) => Promise<DisplayToken>;
  deleteToken: (id: string) => Promise<void>;
  validateToken: (token: string) => Promise<DisplayToken | null>;
  refreshTokens: () => Promise<void>;
  getTokenViews: (tokenId: string) => Promise<ViewRecord[]>;
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
        setIsLoading(false);
        return;
      }

      // Fetch all view stats for all tokens
      const { data: viewStats, error: viewsError } = await supabase
        .from('display_token_views')
        .select('*')
        .order('viewed_at', { ascending: false });

      if (viewsError) {
        console.error('Error fetching view stats:', viewsError);
      }

      // Aggregate view stats per token
      const viewStatsMap = new Map<string, {
        count: number;
        lastViewed: Date | null;
        uniqueIPs: Set<string>;
        deviceStats: DeviceStats;
        browserStats: BrowserStats;
        resolutions: Map<string, number>;
        recentViews: ViewRecord[];
      }>();

      if (viewStats) {
        for (const view of viewStats) {
          const existing = viewStatsMap.get(view.token_id);
          const viewedAt = new Date(view.viewed_at);
          
          if (existing) {
            existing.count++;
            if (view.ip_address) existing.uniqueIPs.add(view.ip_address);
            if (!existing.lastViewed || viewedAt > existing.lastViewed) {
              existing.lastViewed = viewedAt;
            }
            
            // Device stats
            const deviceType = (view.device_type || 'unknown') as keyof DeviceStats;
            if (deviceType in existing.deviceStats) {
              existing.deviceStats[deviceType]++;
            }
            
            // Browser stats
            const browser = view.browser || 'unknown';
            existing.browserStats[browser] = (existing.browserStats[browser] || 0) + 1;
            
            // Screen resolution
            if (view.screen_width && view.screen_height) {
              const res = `${view.screen_width}x${view.screen_height}`;
              existing.resolutions.set(res, (existing.resolutions.get(res) || 0) + 1);
            }
            
            // Keep only 20 most recent views
            if (existing.recentViews.length < 20) {
              existing.recentViews.push(view);
            }
          } else {
            const deviceStats: DeviceStats = { desktop: 0, mobile: 0, tablet: 0, tv: 0, unknown: 0 };
            const deviceType = (view.device_type || 'unknown') as keyof DeviceStats;
            if (deviceType in deviceStats) {
              deviceStats[deviceType] = 1;
            }
            
            const browserStats: BrowserStats = {};
            const browser = view.browser || 'unknown';
            browserStats[browser] = 1;
            
            const resolutions = new Map<string, number>();
            if (view.screen_width && view.screen_height) {
              resolutions.set(`${view.screen_width}x${view.screen_height}`, 1);
            }
            
            viewStatsMap.set(view.token_id, {
              count: 1,
              lastViewed: viewedAt,
              uniqueIPs: new Set(view.ip_address ? [view.ip_address] : []),
              deviceStats,
              browserStats,
              resolutions,
              recentViews: [view]
            });
          }
        }
      }

      const transformedTokens: DisplayTokenWithStats[] = (tokensData || []).map((t: any) => {
        const stats = viewStatsMap.get(t.id);
        const defaultStats = {
          count: 0,
          lastViewed: null,
          uniqueIPs: new Set<string>(),
          deviceStats: { desktop: 0, mobile: 0, tablet: 0, tv: 0, unknown: 0 },
          browserStats: {},
          resolutions: new Map<string, number>(),
          recentViews: []
        };
        const tokenStats = stats || defaultStats;
        
        // Find primary device
        let primaryDevice = 'unknown';
        let maxCount = 0;
        for (const [device, count] of Object.entries(tokenStats.deviceStats)) {
          if (count > maxCount) {
            maxCount = count;
            primaryDevice = device;
          }
        }
        
        // Top resolutions
        const topResolutions: ScreenResolution[] = Array.from(tokenStats.resolutions.entries())
          .map(([resolution, count]) => ({ resolution, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        return {
          id: t.id,
          name: t.name,
          token: t.token,
          createdAt: new Date(t.created_at),
          expiresAt: t.expires_at ? new Date(t.expires_at) : undefined,
          siteFilter: t.site_filter || undefined,
          viewCount: tokenStats.count,
          uniqueViewers: tokenStats.uniqueIPs.size,
          lastViewedAt: tokenStats.lastViewed,
          createdByName: t.profiles?.name || null,
          createdByEmail: t.profiles?.email || null,
          primaryDevice,
          deviceStats: tokenStats.deviceStats,
          browserStats: tokenStats.browserStats,
          topResolutions,
          recentViews: tokenStats.recentViews
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

  const getTokenViews = async (tokenId: string): Promise<ViewRecord[]> => {
    const { data, error } = await supabase
      .from('display_token_views')
      .select('*')
      .eq('token_id', tokenId)
      .order('viewed_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('Error fetching token views:', error);
      return [];
    }
    
    return data || [];
  };

  return (
    <DisplayTokensContext.Provider value={{ tokens, isLoading, addToken, deleteToken, validateToken, refreshTokens, getTokenViews }}>
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
