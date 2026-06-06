// Reusable Payment Experience question graph card. Mirrors the visual grammar
// of ScriptResponsesTab (multi bars, yes/no pills, scale histogram, open-ended
// verbatims) so topic tabs can render the same charts without duplicating the
// Script Responses tab itself.

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PEQuestionSummary } from '@/utils/paymentExperienceScriptResponses';
import { OpenEndedClusters } from '@/components/payment-experience/insights/OpenEndedClusters';

const TYPE_LABELS: Record<string, string> = {
  multi: 'Multiple Choice',
  yesno: 'Yes / No',
  scale: 'Scale',
  open: 'Open Ended',
  compound: 'Compound',
};

export function MultiBars({ summary }: { summary: PEQuestionSummary }) {
  const max = Math.max(1, ...summary.distribution.map((d) => d.count));
  const visible = summary.distribution.filter((d) => d.count > 0);
  return (
    <div className="space-y-2">
      {visible.map((d) => (
        <div key={d.key} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-foreground" title={d.label}>
              {d.label}
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {d.count} · {d.percentage}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/70"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">No responses.</p>
      )}
    </div>
  );
}

export function YesNoPills({ summary }: { summary: PEQuestionSummary }) {
  const yes = summary.distribution.find((d) => d.key === 'yes');
  const no = summary.distribution.find((d) => d.key === 'no');
  const pillBase =
    'flex-1 rounded-lg border p-4 flex items-baseline justify-between gap-3';
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div
        className={cn(
          pillBase,
          'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20',
        )}
      >
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-800 dark:text-amber-300 font-medium">
            Yes
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-amber-900 dark:text-amber-200">
            {yes?.count ?? 0}
          </p>
        </div>
        <span className="text-sm font-medium text-amber-800 dark:text-amber-300 tabular-nums">
          {yes?.percentage ?? 0}%
        </span>
      </div>
      <div className={cn(pillBase, 'border-border bg-muted/40')}>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            No
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
            {no?.count ?? 0}
          </p>
        </div>
        <span className="text-sm font-medium text-muted-foreground tabular-nums">
          {no?.percentage ?? 0}%
        </span>
      </div>
    </div>
  );
}

export function ScaleDisplay({ summary }: { summary: PEQuestionSummary }) {
  const isClarity1to5 =
    summary.question.id === 'move_in_cost_clarity' &&
    summary.min === 1 &&
    summary.max === 5;
  const distribution = isClarity1to5
    ? summary.distribution
    : summary.distribution.filter((d) => d.count > 0);
  const max = Math.max(1, ...distribution.map((d) => d.count));
  const scale = (c: number) => (c <= 0 ? 0 : Math.sqrt(c) / Math.sqrt(max));
  const CHART_PX = 112;
  const MIN_BAR_PX = 12;
  const modalKey = distribution.reduce<string | null>((acc, d) => {
    const accCount = acc == null ? -1 : (distribution.find((x) => x.key === acc)?.count ?? 0);
    return d.count > accCount ? d.key : acc;
  }, null);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums text-foreground">
          {summary.avg != null ? summary.avg.toFixed(1) : '—'}
        </span>
        <span className="text-sm text-muted-foreground">
          avg · range {summary.min}–{summary.max}
        </span>
      </div>

      <div className="flex items-end gap-2" style={{ height: CHART_PX + 18 }}>
        {distribution.map((d) => {
          const isModal = d.count > 0 && d.key === modalKey;
          const px =
            d.count > 0 ? Math.max(MIN_BAR_PX, Math.round(scale(d.count) * CHART_PX)) : 2;
          return (
            <div key={d.key} className="flex-1 flex flex-col items-stretch justify-end">
              <span
                className={cn(
                  'text-center text-[11px] font-medium tabular-nums leading-none mb-1',
                  d.count > 0 ? 'text-foreground' : 'text-muted-foreground/60',
                )}
              >
                {d.percentage}%
              </span>
              <div
                className={cn(
                  'rounded-sm',
                  d.count > 0
                    ? isModal
                      ? 'bg-amber-500/80'
                      : 'bg-foreground/70'
                    : 'bg-muted',
                )}
                style={{ height: px }}
                title={`${d.label}: ${d.count} (${d.percentage}%)`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        {distribution.map((d) => {
          const isModal = d.count > 0 && d.key === modalKey;
          return (
            <span
              key={d.key}
              className={cn(
                'flex-1 text-center text-[11px] font-medium truncate',
                isModal ? 'text-amber-700 dark:text-amber-300' : 'text-foreground/80',
              )}
            >
              {d.label}
            </span>
          );
        })}
      </div>

      {isClarity1to5 && (
        <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>Not clear at all</span>
          <span>Crystal clear</span>
        </div>
      )}
    </div>
  );
}

export function OpenEndedDisplay({ summary }: { summary: PEQuestionSummary }) {
  const [open, setOpen] = useState(false);
  const samples = summary.samples || [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {summary.totalSamples ?? 0} responses
        {samples.length > 0 && ` · showing up to ${samples.length}`}
      </p>
      {samples.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 mr-1" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 mr-1" />
          )}
          {open ? 'Hide responses' : 'Show all'}
        </Button>
      )}
      {open && samples.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-2 space-y-1">
          {samples.map((s, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="shrink-0 text-muted-foreground tabular-nums">
                #{i + 1}
              </span>
              <span className="text-foreground">{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PIE_COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(43, 96%, 56%)',
  'hsl(160, 64%, 45%)',
  'hsl(280, 68%, 60%)',
  'hsl(0, 84%, 60%)',
  'hsl(199, 89%, 48%)',
  'hsl(24, 95%, 53%)',
  'hsl(142, 71%, 45%)',
  'hsl(340, 82%, 60%)',
  'hsl(220, 14%, 50%)',
];

export function PieChart({ summary }: { summary: PEQuestionSummary }) {
  const visible = summary.distribution.filter((d) => d.count > 0);
  const total = visible.reduce((a, d) => a + d.count, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No responses.</p>;
  }

  const size = 160;
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;

  let cursor = -Math.PI / 2;
  const slices = visible.map((d, i) => {
    const frac = d.count / total;
    const start = cursor;
    const end = cursor + frac * Math.PI * 2;
    cursor = end;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = end - start > Math.PI ? 1 : 0;
    const path =
      frac >= 0.999
        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { d, path, color: PIE_COLORS[i % PIE_COLORS.length] };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {slices.map((s, i) => (
          <path
            key={i}
            d={s.path}
            fill={s.color}
            stroke="hsl(var(--background))"
            strokeWidth={2}
          >
            <title>{`${s.d.label}: ${s.d.count} (${s.d.percentage}%)`}</title>
          </path>
        ))}
      </svg>
      <ul className="flex-1 min-w-0 space-y-1.5 w-full">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="truncate text-foreground" title={s.d.label}>
              {s.d.label}
            </span>
            <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
              {s.d.count} · {s.d.percentage}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}


interface ScriptQuestionGraphCardProps {
  summary: PEQuestionSummary;
  total: number;
  compact?: boolean;
}

export function ScriptQuestionGraphCard({
  summary,
  total,
  compact = false,
}: ScriptQuestionGraphCardProps) {
  const q = summary.question;
  return (
    <Card className="h-full">
      <CardContent className={cn('space-y-4', compact ? 'p-4' : 'p-5')}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">
              Q{q.order}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground leading-snug">
                {q.text}
              </p>
              {!compact && (
                <Badge variant="outline" className="mt-1.5 text-[10px] font-normal">
                  {TYPE_LABELS[q.type]}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Responses</p>
            <p className="text-base font-semibold tabular-nums text-foreground">
              {summary.count}
            </p>
          </div>
        </div>

        {summary.count === 0 ? (
          <p className="text-sm text-muted-foreground">No responses for this question.</p>
        ) : q.type === 'compound' ? (
          <div className="space-y-5">
            {(summary.subQuestions || []).map((sub) => (
              <div key={sub.question.id} className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {sub.question.text}
                  </p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {sub.count} responses
                  </span>
                </div>
                {sub.count === 0 ? (
                  <p className="text-sm text-muted-foreground">No responses.</p>
                ) : sub.question.type === 'multi' ? (
                  <MultiBars summary={sub} />
                ) : sub.question.type === 'scale' ? (
                  <ScaleDisplay summary={sub} />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <>
            {q.type === 'multi' && q.id === 'payment_channel' && <PieChart summary={summary} />}
            {q.type === 'multi' && q.id !== 'payment_channel' && <MultiBars summary={summary} />}
            {q.type === 'yesno' && <YesNoPills summary={summary} />}
            {q.type === 'scale' && <ScaleDisplay summary={summary} />}
            {q.type === 'open' && (
              <OpenEndedClusters
                responses={summary.samples ?? []}
                totalSamples={summary.totalSamples ?? summary.count}
              />
            )}
          </>
        )}

        {!compact && summary.count > 0 && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            {q.type === 'multi' && (
              <>
                {summary.uniqueAnswers ?? 0} unique answers
                {summary.topLabel != null && (
                  <>
                    {' · '}Most common:{' '}
                    <span className="text-foreground font-medium">
                      {summary.topLabel}
                    </span>{' '}
                    ({summary.topPct}%)
                  </>
                )}
              </>
            )}
            {q.type === 'yesno' && (
              <>
                {summary.count} of {total} responded (
                {total > 0 ? Math.round((summary.count / total) * 100) : 0}%)
              </>
            )}
            {q.type === 'scale' && (
              <>
                {summary.count} responses · range {summary.min}–{summary.max}
              </>
            )}
            {q.type === 'open' && <>{summary.count} written responses</>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
