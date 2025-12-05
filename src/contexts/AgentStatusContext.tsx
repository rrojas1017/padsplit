import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AgentSession {
  id: string;
  user_id: string;
  agent_id: string | null;
  login_time: string;
  last_activity: string;
  logout_time: string | null;
  is_active: boolean;
}

interface AgentStatusContextType {
  sessions: AgentSession[];
  isLoading: boolean;
}

const AgentStatusContext = createContext<AgentStatusContextType | undefined>(undefined);

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export function AgentStatusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all active sessions (for viewing)
  const fetchSessions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('agent_sessions')
        .select('*')
        .eq('is_active', true)
        .order('login_time', { ascending: false });

      if (error) {
        console.error('Error fetching sessions:', error);
        return;
      }

      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update last activity for current user's session
  const updateActivity = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from('agent_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_active', true);
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  }, [user]);

  // Heartbeat interval for current user
  useEffect(() => {
    if (!user) return;

    // Start heartbeat
    heartbeatRef.current = setInterval(() => {
      updateActivity();
    }, HEARTBEAT_INTERVAL);

    // Initial update
    updateActivity();

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [user, updateActivity]);

  // Handle visibility change (update activity when tab becomes visible)
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, updateActivity]);

  // Handle page unload - end session gracefully
  useEffect(() => {
    if (!user) return;

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliability on page close
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/agent_sessions?user_id=eq.${user.id}&is_active=eq.true`;
      const headers = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Prefer': 'return=minimal',
      };
      
      fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          is_active: false,
          logout_time: new Date().toISOString(),
        }),
        keepalive: true,
      }).catch(() => {
        // Ignore errors on page close
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user]);

  // Fetch sessions on mount and set up realtime subscription
  useEffect(() => {
    if (!user) {
      setSessions([]);
      setIsLoading(false);
      return;
    }

    // Only fetch if user has permission to view (not agents viewing others)
    if (user.role !== 'agent') {
      fetchSessions();
    } else {
      setIsLoading(false);
    }

    // Subscribe to realtime changes
    const channel = supabase
      .channel('agent_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_sessions',
        },
        () => {
          // Refetch on any change
          if (user.role !== 'agent') {
            fetchSessions();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSessions]);

  return (
    <AgentStatusContext.Provider value={{ sessions, isLoading }}>
      {children}
    </AgentStatusContext.Provider>
  );
}

export function useAgentStatus() {
  const context = useContext(AgentStatusContext);
  if (context === undefined) {
    throw new Error('useAgentStatus must be used within an AgentStatusProvider');
  }
  return context;
}
