import { Badge } from '@/components/ui/badge';
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
 * Renders nothing for 'insufficient' (those rows/insights should be suppressed).
 */
export function ConfidenceChip({ level, className }: ConfidenceChipProps) {
  if (level === 'insufficient') return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 px-1.5 text-[10px] font-normal tracking-wide text-muted-foreground border-muted-foreground/20 bg-transparent',
        className,
      )}
    >
      {CONFIDENCE_LABEL[level]}
    </Badge>
  );
}
