import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = async (supabaseUser: SupabaseUser): Promise<boolean> => {
    try {
      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();

      // Get role from user_roles table
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();

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
    } catch (error) {
      console.error('Error fetching user data:', error);
      return false;
    }
  };

  useEffect(() => {
    const isMountedRef = { current: true };
    let initializationComplete = false;
    
    // Timeout failsafe - prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && !initializationComplete) {
        console.warn('Auth initialization timed out, forcing loading state to false');
        setIsLoading(false);
      }
    }, 5000);
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        
        if (event === 'INITIAL_SESSION') {
          // Handle INITIAL_SESSION - this is the first session state from Supabase
          setSession(session);
          if (session?.user) {
            await fetchUserData(session.user);
          }
          initializationComplete = true;
          if (isMountedRef.current) {
            setIsLoading(false);
          }
          return;
        }
        
        // Handle other events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
        setSession(session);
        if (session?.user) {
          await fetchUserData(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    );

    // Handle visibility change (mobile tab resume)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, refreshing session...');
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
      isMountedRef.current = false;
      clearTimeout(timeoutId);
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

      if (data.user) {
        await fetchUserData(data.user);
        
        // Log access
        await supabase.from('access_logs').insert({
          user_id: data.user.id,
          user_name: data.user.email,
          action: 'login',
          resource: '/dashboard',
        });
      }

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
      await supabase.from('access_logs').insert({
        user_id: user.id,
        user_name: user.name,
        action: 'logout',
        resource: window.location.pathname,
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
