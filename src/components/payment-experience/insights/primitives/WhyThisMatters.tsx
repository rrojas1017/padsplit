import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface WhyThisMattersProps {
  children: ReactNode;
  className?: string;
}

/**
 * Consistent supporting explanation line used across Drivers, Risks, and Actions.
 * Keeps tone operational and visually muted.
 */
export function WhyThisMatters({ children, className }: WhyThisMattersProps) {
  return (
    <p
      className={cn(
        'text-[11px] text-muted-foreground/80 leading-snug',
        className,
      )}
    >
      <span className="font-medium text-muted-foreground">Why it matters: </span>
      {children}
    </p>
  );
}
