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

const TYPE_LABELS: Record<string, string> = {
  multi: 'Multiple Choice',
  yesno: 'Yes / No',
  scale: 'Scale',
  open: 'Open Ended',
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
        ) : (
          <>
            {q.type === 'multi' && q.id === 'payment_channel' && <PieChart summary={summary} />}
            {q.type === 'multi' && q.id !== 'payment_channel' && <MultiBars summary={summary} />}
            {q.type === 'yesno' && <YesNoPills summary={summary} />}
            {q.type === 'scale' && <ScaleDisplay summary={summary} />}
            {q.type === 'open' && <OpenEndedDisplay summary={summary} />}
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
