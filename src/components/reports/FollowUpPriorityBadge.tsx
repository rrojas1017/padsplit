import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertTriangle, ArrowUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  FollowUpPriority, 
  PriorityLevel, 
  getPriorityConfig 
} from '@/utils/followUpPriority';

interface FollowUpPriorityBadgeProps {
  priority: FollowUpPriority;
  showTooltip?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

const PriorityIcon = ({ level, className }: { level: PriorityLevel; className?: string }) => {
  switch (level) {
    case 'urgent':
      return <AlertTriangle className={cn('h-3 w-3', className)} />;
    case 'high':
      return <ArrowUp className={cn('h-3 w-3', className)} />;
    case 'medium':
      return <Clock className={cn('h-3 w-3', className)} />;
    default:
      return null;
  }
};

export function FollowUpPriorityBadge({ 
  priority, 
  showTooltip = true, 
  size = 'default',
  className 
}: FollowUpPriorityBadgeProps) {
  // Don't render anything for null/low priority
  if (!priority.level || priority.level === 'low') {
    return null;
  }

  const config = getPriorityConfig(priority.level);
  if (!config) return null;

  const sizeClasses = size === 'sm' 
    ? 'text-[10px] px-1.5 py-0 gap-0.5' 
    : 'text-xs px-2 py-0.5 gap-1';

  const badge = (
    <Badge 
      variant="outline" 
      className={cn(
        'font-semibold flex items-center border',
        config.className,
        sizeClasses,
        className
      )}
    >
      <PriorityIcon level={priority.level} />
      {config.label}
    </Badge>
  );

  if (!showTooltip || !priority.reason) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="text-sm">{priority.reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
