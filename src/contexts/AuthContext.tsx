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

  // Exponential backoff delays: 500ms, 1s, 2s, 4s
  const getRetryDelay = (attempt: number): number => {
    const delays = [500, 1000, 2000, 4000];
    return delays[attempt] || delays[delays.length - 1];
  };

  const fetchUserData = async (supabaseUser: SupabaseUser, retryCount = 0): Promise<boolean> => {
    const maxRetries = 5;
    
    try {
      // SPLIT QUERIES: Simpler RLS evaluation, better reliability
      // Query 1: Fetch profile (simple RLS: id = auth.uid())
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw profileError;
      }

      // Query 2: Fetch role separately (simple RLS: user_id = auth.uid())
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();

      if (roleError) {
        console.error('Role fetch error:', roleError);
        throw roleError;
      }

      if (profileData) {
        const userData: User = {
          id: supabaseUser.id,
          name: profileData.name || supabaseUser.email || 'User',
          email: profileData.email || supabaseUser.email || '',
          role: (roleData?.role as UserRole) || 'agent',
          siteId: profileData.site_id || undefined,
          avatarUrl: profileData.avatar_url || undefined,
          status: profileData.status as 'active' | 'inactive',
        };
        setUser(userData);
        return true;
      }
      return false;
    } catch (error: any) {
      const delay = getRetryDelay(retryCount);
      console.error(`Error fetching user data (attempt ${retryCount + 1}/${maxRetries}):`, error);
      
      if (retryCount < maxRetries - 1) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchUserData(supabaseUser, retryCount + 1);
      }
      
      return false;
    }
  };

  // Fallback: Set minimal user data from auth when profile fetch fails
  const setMinimalUser = (supabaseUser: SupabaseUser) => {
    const minimalUser: User = {
      id: supabaseUser.id,
      name: supabaseUser.email?.split('@')[0] || 'User',
      email: supabaseUser.email || '',
      role: 'agent', // Default role
      status: 'active',
    };
    setUser(minimalUser);
    
    // Try to fetch complete profile in background
    setTimeout(() => {
      fetchUserData(supabaseUser);
    }, 2000);
  };

  useEffect(() => {
    let isMounted = true;

    // Clear corrupted auth storage (helps recover from invalid refresh tokens)
    const clearAuthStorage = () => {
      // Supabase stores auth in localStorage with project-specific keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    };

    // Initialize: check for existing session on page load/refresh
    const initAuth = async () => {
      try {
        // Add timeout to prevent hanging if Supabase is slow
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }, error: Error }>((_, reject) => {
          setTimeout(() => reject(new Error('Session timeout')), 5000);
        });
        
        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise.catch(() => ({ data: { session: null }, error: null }))
        ]);

        // Handle invalid refresh token error
        if (error) {
          const errorMessage = error.message?.toLowerCase() || '';
          if (errorMessage.includes('refresh token') || errorMessage.includes('invalid')) {
            console.warn('Invalid refresh token detected, clearing auth storage');
            clearAuthStorage();
            if (isMounted) {
              setSession(null);
              setUser(null);
              setIsLoading(false);
            }
            return;
          }
        }
        
        if (session?.user && isMounted) {
          setSession(session);
          // CRITICAL: Wait for user data to be fetched before setting isLoading = false
          const success = await fetchUserData(session.user);
          if (isMounted) {
            if (success) {
              setTimeout(() => {
                startAgentSession(session.user.id, 'agent');
              }, 100);
            } else {
              // Fallback: set minimal user so we don't redirect to login
              setMinimalUser(session.user);
            }
            setIsLoading(false);
          }
        } else if (isMounted) {
          // No session, set loading to false
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('Auth init error:', error);
        // Handle token-related errors gracefully
        const errorMessage = error?.message?.toLowerCase() || '';
        if (errorMessage.includes('refresh token') || errorMessage.includes('invalid')) {
          clearAuthStorage();
        }
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
        
        // Handle SIGNED_IN event for session restoration (fires on refresh with valid session)
        if (event === 'SIGNED_IN' && session?.user) {
          setSession(session);
          // Defer to avoid Supabase deadlock
          setTimeout(() => {
            fetchUserData(session.user);
          }, 0);
        }
        
        // Handle token refresh
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setSession(session);
          setTimeout(() => {
            fetchUserData(session.user);
          }, 0);
        }
      }
    );

    // Handle visibility change (mobile tab resume) with error handling
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          // Handle invalid refresh token on tab resume
          if (error) {
            const errorMessage = error.message?.toLowerCase() || '';
            if (errorMessage.includes('refresh token') || errorMessage.includes('invalid')) {
              console.warn('Invalid refresh token on visibility change, clearing auth');
              clearAuthStorage();
              setSession(null);
              setUser(null);
              return;
            }
          }
          
          if (session?.user) {
            setSession(session);
            fetchUserData(session.user);
          }
        } catch (error) {
          console.error('Error restoring session on visibility change:', error);
        }
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

      // Validate IP restriction for agents
      try {
        const { data: ipCheckData, error: ipError } = await supabase.functions.invoke('validate-login-ip');
        
        if (ipError) {
          console.warn('IP validation check failed:', ipError);
          // Continue with login if IP check fails (fail-open for reliability)
        } else if (ipCheckData?.blocked) {
          // IP blocked - sign out immediately and return error
          console.warn('Login blocked: IP not allowed', ipCheckData);
          await supabase.auth.signOut();
          return { 
            success: false, 
            error: ipCheckData.message || 'Login not allowed from this location. Please contact your supervisor.' 
          };
        }
      } catch (ipCheckError) {
        console.warn('IP validation error (non-blocking):', ipCheckError);
        // Continue with login if IP check throws (fail-open for reliability)
      }

      // Fetch user data with improved retry logic
      const success = await fetchUserData(data.user);
      
      if (!success) {
        // FALLBACK: Allow login with minimal data, fetch complete profile in background
        console.warn('Profile fetch failed, using fallback minimal user data');
        setMinimalUser(data.user);
      }

      // Start agent session (fire-and-forget, deferred)
      setTimeout(() => {
        startAgentSession(data.user.id, 'agent');
      }, 100);

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
