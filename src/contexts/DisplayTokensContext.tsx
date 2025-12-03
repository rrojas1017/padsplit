import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface DisplayToken {
  id: string;
  name: string;
  token: string;
  createdAt: Date;
  expiresAt?: Date;
  siteFilter?: string;
}

interface DisplayTokensContextType {
  tokens: DisplayToken[];
  addToken: (token: Omit<DisplayToken, 'id' | 'token' | 'createdAt'>) => DisplayToken;
  deleteToken: (id: string) => void;
  validateToken: (token: string) => DisplayToken | null;
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
  const [tokens, setTokens] = useState<DisplayToken[]>(() => {
    const saved = localStorage.getItem('padsplit-display-tokens');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        expiresAt: t.expiresAt ? new Date(t.expiresAt) : undefined,
      }));
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('padsplit-display-tokens', JSON.stringify(tokens));
  }, [tokens]);

  const addToken = (tokenData: Omit<DisplayToken, 'id' | 'token' | 'createdAt'>): DisplayToken => {
    const newToken: DisplayToken = {
      ...tokenData,
      id: `token-${Date.now()}`,
      token: generateToken(),
      createdAt: new Date(),
    };
    setTokens(prev => [...prev, newToken]);
    return newToken;
  };

  const deleteToken = (id: string) => {
    setTokens(prev => prev.filter(token => token.id !== id));
  };

  const validateToken = (tokenString: string): DisplayToken | null => {
    const token = tokens.find(t => t.token === tokenString);
    if (!token) return null;
    if (token.expiresAt && new Date() > token.expiresAt) return null;
    return token;
  };

  return (
    <DisplayTokensContext.Provider value={{ tokens, addToken, deleteToken, validateToken }}>
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
