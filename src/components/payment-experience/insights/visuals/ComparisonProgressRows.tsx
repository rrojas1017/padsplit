import { cn } from '@/lib/utils';
import { ConfidenceChip } from '../primitives/ConfidenceChip';
import type { ConfidenceLevel } from '@/utils/paymentExperienceAnalytics';

type Tone = 'blue' | 'green' | 'orange' | 'slate';

const TONE_FILL: Record<Tone, string> = {
  blue: 'bg-blue-500/70',
  green: 'bg-green-500/70',
  orange: 'bg-orange-500/70',
  slate: 'bg-slate-500/60',
};

interface ComparisonRow {
  label: string;
  percent: number | null;
  valueLabel: string;
  n: number;
  confidence?: ConfidenceLevel;
}

interface ComparisonProgressRowsProps {
  rows: ComparisonRow[];
  tone?: Tone;
}

export function ComparisonProgressRows({ rows, tone = 'green' }: ComparisonProgressRowsProps) {
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const width = r.percent == null ? 0 : Math.max(0, Math.min(100, r.percent));
        return (
          <div
            key={r.label}
            role="group"
            aria-label={`${r.label}: ${r.valueLabel}, N=${r.n}`}
            className="space-y-1"
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="text-sm font-medium text-foreground min-w-0 truncate">{r.label}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground tabular-nums">{r.valueLabel}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">N={r.n}</span>
                {r.confidence && <ConfidenceChip level={r.confidence} />}
              </div>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden" aria-hidden="true">
              {r.percent != null && (
                <div
                  className={cn('h-full rounded-full transition-all', TONE_FILL[tone])}
                  style={{ width: `${width}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
