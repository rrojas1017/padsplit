import { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  hint?: ReactNode;
}

export function SectionHeader({ title, hint }: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-3 pt-2">
      <h2 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {title}
      </h2>
      {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
    </div>
  );
}
