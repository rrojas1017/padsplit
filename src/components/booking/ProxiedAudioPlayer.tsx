import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProxiedAudioPlayerProps {
  bookingId: string;
}

export function ProxiedAudioPlayer({ bookingId }: ProxiedAudioPlayerProps) {
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAudio = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) {
          setError('Not authenticated');
          setIsLoading(false);
          return;
        }

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-recording-audio?bookingId=${encodeURIComponent(bookingId)}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `Failed to load recording (${response.status})`);
        }

        const blob = await response.blob();
        if (cancelled) return;

        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setAudioSrc(blobUrl);
      } catch (err) {
        if (!cancelled) {
          console.error('Audio proxy error:', err);
          setError(err instanceof Error ? err.message : 'Failed to load recording');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadAudio();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [bookingId]);

  return (
    <Card className="mb-4">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-3">
          <Play className="h-5 w-5 text-primary" />
          <span className="font-medium">Call Recording</span>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {error ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span>{error}</span>
          </div>
        ) : (
          <audio
            controls
            src={audioSrc || undefined}
            className="w-full h-10 rounded-lg"
            preload="metadata"
          />
        )}
      </CardContent>
    </Card>
  );
}
