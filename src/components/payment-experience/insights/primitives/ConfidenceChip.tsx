import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  CONFIDENCE_LABEL,
  type ConfidenceLevel,
} from '@/utils/paymentExperienceAnalytics';

interface ConfidenceChipProps {
  level: ConfidenceLevel;
  className?: string;
}

/**
 * Subtle, informational confidence badge. Never alert-colored.
 * Hover reveals sample-size thresholds for transparency.
 */
export function ConfidenceChip({ level, className }: ConfidenceChipProps) {
  if (level === 'insufficient') return null;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            'h-5 px-1.5 text-[10px] font-normal tracking-wide text-muted-foreground border-muted-foreground/20 bg-transparent cursor-help',
            className,
          )}
        >
          {CONFIDENCE_LABEL[level]}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11px] max-w-[220px]">
        High ≥ 50 responses · Moderate ≥ 20 · Limited ≥ 5
      </TooltipContent>
    </Tooltip>
  );
}
