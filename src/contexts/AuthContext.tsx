import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, UserRole } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

// Session management functions (defined outside component to avoid re-creation)
const startAgentSession = async (userId: string, userRole: string) => {
  try {
    // Mark any existing active sessions as inactive
    await supabase
      .from('agent_sessions')
      .update({ is_active: false, logout_time: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Get agent_id if user is an agent
    let agentId = null;
    if (userRole === 'agent') {
      const { data: agentData } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      agentId = agentData?.id || null;
    }

    // Create new session
    await supabase
      .from('agent_sessions')
      .insert({
        user_id: userId,
        agent_id: agentId,
        login_time: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        is_active: true,
      });
  } catch (error) {
    console.error('Error starting agent session:', error);
  }
};

const endAgentSession = async (userId: string) => {
  try {
    await supabase
      .from('agent_sessions')
      .update({
        is_active: false,
        logout_time: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_active', true);
  } catch (error) {
    console.error('Error ending agent session:', error);
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = async (supabaseUser: SupabaseUser, retryCount = 0): Promise<boolean> => {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second between retries
    
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();

      if (roleError) {
        throw roleError;
      }

      if (profile) {
        const userData: User = {
          id: supabaseUser.id,
          name: profile.name || supabaseUser.email || 'User',
          email: profile.email || supabaseUser.email || '',
          role: (roleData?.role as UserRole) || 'agent',
          siteId: profile.site_id || undefined,
          avatarUrl: profile.avatar_url || undefined,
          status: profile.status as 'active' | 'inactive',
        };
        setUser(userData);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error(`Error fetching user data (attempt ${retryCount + 1}/${maxRetries}):`, error);
      
      // Retry on timeout or network errors
      if (retryCount < maxRetries - 1) {
        console.log(`Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchUserData(supabaseUser, retryCount + 1);
      }
      
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Initialize: check for existing session on page load/refresh
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && isMounted) {
          setSession(session);
          const success = await fetchUserData(session.user);
          
          // Start agent session for existing logged-in users
          if (success) {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();
            
            startAgentSession(session.user.id, roleData?.role || 'agent');
          }
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes (sign out from other tabs, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event);
        
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
        }
        
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setSession(session);
          // Defer to avoid Supabase deadlock
          setTimeout(() => {
            fetchUserData(session.user);
          }, 0);
        }
      }
    );

    // Handle visibility change (mobile tab resume)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            setSession(session);
            fetchUserData(session.user);
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Login failed - no user returned' };
      }

      // Set session immediately
      setSession(data.session);

      // Fetch user data directly - simple sequential flow
      const success = await fetchUserData(data.user);
      
      if (!success) {
        return { success: false, error: 'Failed to load user profile. Please try again.' };
      }

      // Get user role for session tracking
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();

      // Start agent session (fire-and-forget)
      startAgentSession(data.user.id, roleData?.role || 'agent');

      // Log access (fire-and-forget)
      supabase.from('access_logs').insert({
        user_id: data.user.id,
        user_name: data.user.email,
        action: 'login',
        resource: '/dashboard',
      }).then(({ error }) => {
        if (error) console.error('Failed to log login:', error);
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Update profile with name
        await supabase.from('profiles')
          .update({ name })
          .eq('id', data.user.id);
          
        // Assign default role (agent)
        await supabase.from('user_roles').insert({
          user_id: data.user.id,
          role: 'agent',
        });
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Signup failed' };
    }
  };

  const logout = async () => {
    if (user) {
      // End agent session (fire-and-forget)
      endAgentSession(user.id);

      // Fire-and-forget logout logging
      supabase.from('access_logs').insert({
        user_id: user.id,
        user_name: user.name,
        action: 'logout',
        resource: window.location.pathname,
      }).then(({ error }) => {
        if (error) console.error('Failed to log logout:', error);
      });
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
