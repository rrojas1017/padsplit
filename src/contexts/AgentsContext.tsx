import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Agent } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { deduplicatedQuery, debounce } from '@/utils/databaseCircuitBreaker';

interface AgentsContextType {
  agents: Agent[];
  sites: { id: string; name: string; type: string }[];
  isLoading: boolean;
  addAgent: (agent: Omit<Agent, 'id'>) => Promise<void>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  toggleAgentStatus: (id: string) => Promise<void>;
}

const AgentsContext = createContext<AgentsContextType | undefined>(undefined);

export function AgentsProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sites, setSites] = useState<{ id: string; name: string; type: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);
  const fetchInProgressRef = useRef<boolean>(false);

  const fetchSites = useCallback(async () => {
    try {
      const result = await deduplicatedQuery('sites-fetch', async () => {
        const { data, error } = await supabase
          .from('sites')
          .select('*')
          .order('name')
          .limit(100);

        if (error) throw error;
        return data;
      });

      if (result) {
        setSites(result);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) {
      console.log('[AgentsContext] Fetch already in progress, skipping');
      return;
    }

    // Rate limit: minimum 5 seconds between fetches
    const now = Date.now();
    if (now - lastFetchRef.current < 5000) {
      console.log('[AgentsContext] Rate limited, skipping fetch');
      return;
    }

    try {
      fetchInProgressRef.current = true;
      setIsLoading(true);
      
      const result = await deduplicatedQuery('agents-fetch', async () => {
        const { data, error } = await supabase
          .from('agents')
          .select(`
        id, name, site_id, active, avatar_url, user_id, dialer_agent_user,
            sites(name)
          `)
          .order('name')
          .limit(500);

        if (error) throw error;
        return data;
      });

      if (!result) {
        // Circuit breaker blocked the query
        return;
      }

      lastFetchRef.current = Date.now();

      const transformedAgents: Agent[] = (result || []).map((a: any) => ({
        id: a.id,
        userId: a.user_id || undefined,
        name: a.name,
        siteId: a.site_id,
        siteName: a.sites?.name || 'Unknown',
        active: a.active,
        avatarUrl: a.avatar_url || undefined,
        dialerAgentUser: a.dialer_agent_user || undefined,
      }));

      setAgents(transformedAgents);
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      fetchInProgressRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Debounced version for realtime updates
  const debouncedFetchAgents = useCallback(
    debounce(() => fetchAgents(), 2000),
    [fetchAgents]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setAgents([]);
      setSites([]);
      setIsLoading(false);
      return;
    }

    // User is authenticated, fetch data
    fetchSites();
    fetchAgents();

    // Set up realtime subscription with debounced handler
    const channel = supabase
      .channel('agents-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agents' },
        () => {
          debouncedFetchAgents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, fetchSites, fetchAgents, debouncedFetchAgents]);

  const addAgent = async (agentData: Omit<Agent, 'id'>) => {
    const { error } = await supabase.from('agents').insert({
      name: agentData.name,
      site_id: agentData.siteId,
      active: agentData.active ?? true,
      user_id: agentData.userId || null,
      avatar_url: agentData.avatarUrl || null,
      dialer_agent_user: agentData.dialerAgentUser || null,
    });

    if (error) {
      console.error('Error adding agent:', error);
      throw error;
    }

    await fetchAgents();
  };

  const updateAgent = async (id: string, updates: Partial<Agent>) => {
    const updateData: any = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.siteId !== undefined) updateData.site_id = updates.siteId;
    if (updates.active !== undefined) updateData.active = updates.active;
    if (updates.userId !== undefined) updateData.user_id = updates.userId;
    if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl;
    if (updates.dialerAgentUser !== undefined) updateData.dialer_agent_user = updates.dialerAgentUser || null;

    const { error } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating agent:', error);
      throw error;
    }

    await fetchAgents();
  };

  const deleteAgent = async (id: string) => {
    const { error } = await supabase.from('agents').delete().eq('id', id);

    if (error) {
      console.error('Error deleting agent:', error);
      throw error;
    }

    await fetchAgents();
  };

  const toggleAgentStatus = async (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;

    const { error } = await supabase
      .from('agents')
      .update({ active: !agent.active })
      .eq('id', id);

    if (error) {
      console.error('Error toggling agent status:', error);
      throw error;
    }

    await fetchAgents();
  };

  return (
    <AgentsContext.Provider value={{ agents, sites, isLoading, addAgent, updateAgent, deleteAgent, toggleAgentStatus }}>
      {children}
    </AgentsContext.Provider>
  );
}

export function useAgents() {
  const context = useContext(AgentsContext);
  if (!context) {
    throw new Error('useAgents must be used within an AgentsProvider');
  }
  return context;
}
