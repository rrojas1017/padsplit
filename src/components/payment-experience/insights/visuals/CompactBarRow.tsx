import { cn } from '@/lib/utils';

type Tone = 'blue' | 'green' | 'orange' | 'slate';

const TONE_FILL: Record<Tone, string> = {
  blue: 'bg-blue-500/70',
  green: 'bg-green-500/70',
  orange: 'bg-orange-500/70',
  slate: 'bg-slate-500/60',
};

interface CompactBarRowProps {
  label: string;
  valueLabel: string;
  percent: number | null;
  n?: number;
  rightSlot?: React.ReactNode;
  helper?: string;
  tone?: Tone;
  ariaLabel?: string;
}

export function CompactBarRow({
  label,
  valueLabel,
  percent,
  n,
  rightSlot,
  helper,
  tone = 'blue',
  ariaLabel,
}: CompactBarRowProps) {
  const width = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <div
      role="group"
      aria-label={ariaLabel ?? `${label}: ${valueLabel}${n != null ? `, N=${n}` : ''}`}
      className="space-y-1"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground min-w-0 truncate">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{valueLabel}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden" aria-hidden="true">
        {percent != null && (
          <div
            className={cn('h-full rounded-full transition-all', TONE_FILL[tone])}
            style={{ width: `${width}%` }}
          />
        )}
      </div>
      {(rightSlot || helper || n != null) && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {helper ? (
            <span className="text-[11px] text-muted-foreground/70 min-w-0 truncate">{helper}</span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            {n != null && (
              <span className="text-[11px] text-muted-foreground tabular-nums">N={n}</span>
            )}
            {rightSlot}
          </div>
        </div>
      )}
    </div>
  );
}
