import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  hint?: ReactNode;
  emphasis?: boolean;
}

export function SectionHeader({ title, hint, emphasis }: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-3 pt-0.5">
      <h2
        className={cn(
          emphasis
            ? 'text-sm font-semibold tracking-wide text-foreground'
            : 'text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase',
        )}
      >
        {title}
      </h2>
      {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
    </div>
  );
}
