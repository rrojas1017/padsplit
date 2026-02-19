import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ProbingFollowUpsProps {
  probes: string[];
  label?: string;
  variant?: 'default' | 'branch-yes' | 'branch-no';
}

export function ProbingFollowUps({ probes, label = 'Probing follow-ups', variant = 'default' }: ProbingFollowUpsProps) {
  const [open, setOpen] = useState(variant !== 'default'); // auto-open branch probes
  const [activated, setActivated] = useState<Set<number>>(new Set());

  if (!probes || probes.length === 0) return null;

  const toggleActivated = (idx: number) => {
    setActivated(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const borderColor =
    variant === 'branch-yes'
      ? 'border-green-500/30 bg-green-500/5'
      : variant === 'branch-no'
      ? 'border-orange-500/30 bg-orange-500/5'
      : 'border-muted bg-muted/30';

  const labelColor =
    variant === 'branch-yes'
      ? 'text-green-700 dark:text-green-400'
      : variant === 'branch-no'
      ? 'text-orange-700 dark:text-orange-400'
      : 'text-muted-foreground';

  return (
    <div className={cn('rounded-lg border p-3 space-y-2', borderColor)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn('flex items-center gap-2 text-xs font-medium w-full', labelColor)}
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {label} ({probes.length})
      </button>

      {open && (
        <div className="space-y-1.5 pt-1">
          {probes.map((probe, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleActivated(idx)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md text-sm transition-all border',
                activated.has(idx)
                  ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                  : 'bg-background border-transparent hover:border-muted-foreground/20 hover:bg-accent/50 text-foreground'
              )}
            >
              <span className="mr-2 text-muted-foreground">{activated.has(idx) ? '✓' : '○'}</span>
              {probe}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
