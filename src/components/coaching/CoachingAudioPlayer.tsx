import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Headphones, Play, Pause, Loader2, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CoachingAudioPlayerProps {
  bookingId: string;
  audioUrl?: string | null;
  onAudioGenerated?: () => void;
  variant?: 'button' | 'inline' | 'card';
  className?: string;
}

export function CoachingAudioPlayer({
  bookingId,
  audioUrl,
  onAudioGenerated,
  variant = 'button',
  className,
}: CoachingAudioPlayerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(audioUrl || null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setCurrentAudioUrl(audioUrl || null);
  }, [audioUrl]);

  const handleGenerateAudio = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-coaching-audio', {
        body: { bookingId },
      });

      if (error) throw error;

      if (data?.success && data?.audioUrl) {
        setCurrentAudioUrl(data.audioUrl);
        toast.success('Coaching audio ready! 🎧');
        onAudioGenerated?.();
      } else {
        throw new Error(data?.error || 'Failed to generate audio');
      }
    } catch (error) {
      console.error('Audio generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate coaching audio');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const currentProgress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(currentProgress);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // If no audio exists, show generate button
  if (!currentAudioUrl) {
    if (variant === 'button') {
      return (
        <Button
          onClick={handleGenerateAudio}
          disabled={isGenerating}
          size="sm"
          variant="outline"
          className={cn("gap-2", className)}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Headphones className="h-4 w-4" />
              Play Coaching
            </>
          )}
        </Button>
      );
    }

    return (
      <div 
        onClick={!isGenerating ? handleGenerateAudio : undefined}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors",
          isGenerating && "cursor-wait",
          className
        )}
      >
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          {isGenerating ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <Headphones className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">
            {isGenerating ? 'Generating your coaching...' : 'Listen to your coaching'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isGenerating ? 'This may take a few seconds' : 'Get personalized audio feedback'}
          </p>
        </div>
      </div>
    );
  }

  // Audio exists - show player
  return (
    <div className={cn("space-y-2", className)}>
      <audio
        ref={audioRef}
        src={currentAudioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {variant === 'card' ? (
        <div className="flex items-center gap-4 p-4 rounded-lg border border-accent/30 bg-gradient-to-r from-accent/10 to-accent/5">
          <button
            onClick={handlePlayPause}
            className="w-12 h-12 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors"
          >
            {isPlaying ? (
              <Pause className="h-6 w-6 text-accent-foreground" />
            ) : (
              <Play className="h-6 w-6 text-accent-foreground ml-0.5" />
            )}
          </button>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-accent" />
                Your Coaching Feedback
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTime(duration)}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      ) : variant === 'inline' ? (
        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
          <button
            onClick={handlePlayPause}
            className="w-8 h-8 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-accent-foreground" />
            ) : (
              <Play className="h-4 w-4 text-accent-foreground ml-0.5" />
            )}
          </button>
          <div className="flex-1 bg-muted rounded-full h-1.5">
            <div
              className="bg-accent h-1.5 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground min-w-[40px]">
            {formatTime(audioRef.current?.currentTime || 0)}
          </span>
        </div>
      ) : (
        <Button
          onClick={handlePlayPause}
          size="sm"
          variant="outline"
          className={cn("gap-2", isPlaying && "bg-accent/20")}
        >
          {isPlaying ? (
            <>
              <Pause className="h-4 w-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Play Coaching
            </>
          )}
        </Button>
      )}
    </div>
  );
}