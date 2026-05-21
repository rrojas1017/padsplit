import { cn } from '@/lib/utils';

type Tone = 'blue' | 'green' | 'orange' | 'slate';

const TONE_FILL: Record<Tone, string> = {
  blue: 'bg-blue-500/70',
  green: 'bg-green-500/70',
  orange: 'bg-orange-500/70',
  slate: 'bg-slate-500/60',
};

interface RankedBarRow {
  label: string;
  count: number;
  share: number; // 0-1
  detail?: React.ReactNode;
}

interface RankedBarListProps {
  rows: RankedBarRow[];
  maxRows?: number;
  tone?: Tone;
}

export function RankedBarList({ rows, maxRows, tone = 'blue' }: RankedBarListProps) {
  const visible = maxRows ? rows.slice(0, maxRows) : rows;
  const maxShare = visible.reduce((m, r) => Math.max(m, r.share || 0), 0) || 1;
  return (
    <ul className="space-y-3">
      {visible.map((r) => {
        const pct = Math.round((r.share || 0) * 100);
        const width = Math.max(0, Math.min(100, ((r.share || 0) / maxShare) * 100));
        return (
          <li
            key={r.label}
            role="group"
            aria-label={`${r.label}: ${r.count} responses, ${pct}%`}
            className="border-b border-border last:border-0 pb-2 last:pb-0 space-y-1"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-foreground min-w-0 truncate">{r.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {r.count} · {pct}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden" aria-hidden="true">
              <div
                className={cn('h-full rounded-full transition-all', TONE_FILL[tone])}
                style={{ width: `${width}%` }}
              />
            </div>
            {r.detail && (
              <div className="text-xs text-muted-foreground leading-relaxed break-words">
                {r.detail}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
