import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InsightRowProps {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function InsightRow({ label, value, meta, className }: InsightRowProps) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-border last:border-0 pb-2 last:pb-0',
        className,
      )}
    >
      <span className="text-sm font-medium text-foreground min-w-0 truncate">{label}</span>
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-sm tabular-nums text-foreground">{value}</span>
        {meta}
      </div>
    </div>
  );
}
