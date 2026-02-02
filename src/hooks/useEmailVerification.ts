import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EmailVerificationStatus } from '@/components/reports/EmailVerificationBadge';

interface UseEmailVerificationOptions {
  debounceMs?: number;
}

export function useEmailVerification(
  email: string,
  options: UseEmailVerificationOptions = {}
) {
  const { debounceMs = 800 } = options;
  
  const [status, setStatus] = useState<EmailVerificationStatus>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastVerifiedEmail, setLastVerifiedEmail] = useState<string | null>(null);

  // Basic email format validation
  const isValidFormat = useCallback((email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email.trim() !== '' && emailRegex.test(email.trim());
  }, []);

  useEffect(() => {
    // Reset if email is empty or invalid format
    if (!email || !isValidFormat(email)) {
      setStatus(null);
      setIsVerifying(false);
      return;
    }

    // Skip if already verified this exact email
    if (email === lastVerifiedEmail && status !== null) {
      return;
    }

    // Debounce the API call
    const timer = setTimeout(async () => {
      setIsVerifying(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('verify-email-realtime', {
          body: { email: email.trim() }
        });

        if (error) {
          console.error('Email verification error:', error);
          setStatus('unknown');
        } else {
          setStatus(data?.status || 'unknown');
          setLastVerifiedEmail(email);
        }
      } catch (err) {
        console.error('Email verification failed:', err);
        setStatus('unknown');
      } finally {
        setIsVerifying(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [email, debounceMs, isValidFormat, lastVerifiedEmail, status]);

  // Reset function for when email changes significantly
  const reset = useCallback(() => {
    setStatus(null);
    setIsVerifying(false);
    setLastVerifiedEmail(null);
  }, []);

  return {
    status,
    isVerifying,
    isValidFormat: isValidFormat(email),
    reset
  };
}
