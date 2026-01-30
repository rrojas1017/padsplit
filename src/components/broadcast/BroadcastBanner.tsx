import { useBroadcastMessages } from '@/hooks/useBroadcastMessages';
import { Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BroadcastBannerProps {
  className?: string;
}

export function BroadcastBanner({ className }: BroadcastBannerProps) {
  const { broadcasts, isLoading } = useBroadcastMessages();

  // Don't show anything if loading or no broadcasts
  if (isLoading || broadcasts.length === 0) {
    return null;
  }

  // Combine all messages with separators
  const combinedMessage = broadcasts.map(b => b.message).join('  •  ');

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border border-primary/30 py-2.5 px-4 mb-4",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Megaphone className="w-4 h-4 text-primary" />
        </div>
        
        <div className="flex-1 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap inline-block">
            <span className="text-sm font-medium text-foreground">
              {combinedMessage}
            </span>
            <span className="mx-8 text-primary/50">•</span>
            <span className="text-sm font-medium text-foreground">
              {combinedMessage}
            </span>
            <span className="mx-8 text-primary/50">•</span>
            <span className="text-sm font-medium text-foreground">
              {combinedMessage}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
