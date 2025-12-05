import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  // Safety timeout - if still loading after 8 seconds, redirect to login
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Auth check timed out after 8 seconds, redirecting to login');
        setTimedOut(true);
      }
    }, 8000);
    
    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Handle navigation based on auth state or timeout
  useEffect(() => {
    if (timedOut) {
      navigate('/login');
      return;
    }
    
    if (!isLoading) {
      if (user) {
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    }
  }, [user, isLoading, timedOut, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
};

export default Index;
