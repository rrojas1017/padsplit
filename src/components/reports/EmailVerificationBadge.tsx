import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type EmailVerificationStatus = 'valid' | 'invalid' | 'disposable' | 'catch_all' | 'unknown' | null;

interface EmailVerificationBadgeProps {
  status: EmailVerificationStatus;
  verified?: boolean | null;
  className?: string;
}

const statusConfig: Record<string, {
  icon: React.ReactNode;
  tooltip: string;
  colorClass: string;
}> = {
  valid: {
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    tooltip: 'Email verified',
    colorClass: 'text-success',
  },
  invalid: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    tooltip: 'Invalid email',
    colorClass: 'text-destructive',
  },
  disposable: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    tooltip: 'Disposable email',
    colorClass: 'text-warning',
  },
  catch_all: {
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    tooltip: 'Catch-all domain',
    colorClass: 'text-muted-foreground',
  },
};

export function EmailVerificationBadge({ status, verified, className }: EmailVerificationBadgeProps) {
  // Don't show badge if status is null, unknown, or not checked
  if (!status || status === 'unknown') {
    return null;
  }

  const config = statusConfig[status];
  if (!config) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex items-center cursor-help', config.colorClass, className)}>
            {config.icon}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {config.tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
