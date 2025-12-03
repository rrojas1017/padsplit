import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/types';
import { mockUsers } from '@/data/mockData';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('padsplit_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Mock authentication - in production, this would call an API
    const foundUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!foundUser) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    // For demo, accept any password
    if (password.length < 1) {
      return { success: false, error: 'Password is required' };
    }
    
    setUser(foundUser);
    localStorage.setItem('padsplit_user', JSON.stringify(foundUser));
    
    // Log access
    const accessLog = {
      userId: foundUser.id,
      action: 'login',
      timestamp: new Date().toISOString(),
    };
    const logs = JSON.parse(localStorage.getItem('access_logs') || '[]');
    logs.push(accessLog);
    localStorage.setItem('access_logs', JSON.stringify(logs));
    
    return { success: true };
  };

  const logout = () => {
    if (user) {
      const accessLog = {
        userId: user.id,
        action: 'logout',
        timestamp: new Date().toISOString(),
      };
      const logs = JSON.parse(localStorage.getItem('access_logs') || '[]');
      logs.push(accessLog);
      localStorage.setItem('access_logs', JSON.stringify(logs));
    }
    
    setUser(null);
    localStorage.removeItem('padsplit_user');
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole }}>
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
