// src/components/payment-experience/insights/tabs/ScriptResponsesTab.tsx
// Question-by-question Script Responses tab for the Payment Experience
// Insights dashboard. Pure client-side: derives distributions from existing
// eligible records using the canonical normalization maps.

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PaymentExperienceRecord } from '@/hooks/usePaymentExperienceResponses';
import {
  derivePaymentExperienceScriptData,
  downloadPaymentExperienceScriptCsv,
  type PEQuestionSummary,
} from '@/utils/paymentExperienceScriptResponses';

interface ScriptResponsesTabProps {
  eligibleRecords: PaymentExperienceRecord[];
  totalRouted: number;
}

const TYPE_LABELS: Record<string, string> = {
  multi: 'Multiple Choice',
  yesno: 'Yes / No',
  scale: 'Scale',
  open: 'Open Ended',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function MultiBars({ summary }: { summary: PEQuestionSummary }) {
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

function YesNoPills({
  summary,
  total,
}: {
  summary: PEQuestionSummary;
  total: number;
}) {
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

function ScaleDisplay({ summary }: { summary: PEQuestionSummary }) {
  const max = Math.max(1, ...summary.distribution.map((d) => d.count));
  // Square-root scaling so small buckets remain readable next to a dominant
  // one (e.g. 2 vs 52 → ~20% height instead of ~4%), while order is preserved.
  const scale = (c: number) => (c <= 0 ? 0 : Math.sqrt(c) / Math.sqrt(max));
  const modalKey = summary.distribution.reduce<string | null>((acc, d) => {
    const accCount = acc == null ? -1 : (summary.distribution.find((x) => x.key === acc)?.count ?? 0);
    return d.count > accCount ? d.key : acc;
  }, null);
  const isClarity1to5 =
    summary.question.id === 'move_in_cost_clarity' &&
    summary.min === 1 &&
    summary.max === 5;

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
      <div className="flex items-end gap-2 h-28">
        {summary.distribution.map((d) => {
          const isModal = d.count > 0 && d.key === modalKey;
          const heightPct = scale(d.count) * 100;
          return (
            <div
              key={d.key}
              className="flex-1 flex flex-col items-end gap-1 min-w-0"
              title={`${d.label}: ${d.count} (${d.percentage}%)`}
            >
              <span
                className={cn(
                  'w-full text-center text-[11px] font-medium tabular-nums',
                  d.count > 0 ? 'text-foreground' : 'text-muted-foreground/60',
                )}
              >
                {d.percentage}%
              </span>
              <div
                className={cn(
                  'w-full rounded-sm',
                  d.count > 0
                    ? isModal
                      ? 'bg-amber-500/80'
                      : 'bg-foreground/70'
                    : 'bg-muted',
                )}
                style={{
                  height: d.count > 0 ? `${heightPct}%` : 2,
                  minHeight: d.count > 0 ? 12 : 2,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        {summary.distribution.map((d) => {
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

function OpenEndedDisplay({ summary }: { summary: PEQuestionSummary }) {
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

function QuestionCard({
  summary,
  total,
  highlighted,
}: {
  summary: PEQuestionSummary;
  total: number;
  highlighted: boolean;
}) {
  const q = summary.question;
  return (
    <Card
      id={`pe-question-${q.order}`}
      className={cn(
        'transition-shadow scroll-mt-24',
        highlighted && 'ring-2 ring-amber-400/70 shadow-md',
      )}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">
              Q{q.order}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground leading-snug">
                {q.text}
              </p>
              <Badge variant="outline" className="mt-1.5 text-[10px] font-normal">
                {TYPE_LABELS[q.type]}
              </Badge>
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
            {q.type === 'multi' && <MultiBars summary={summary} />}
            {q.type === 'yesno' && <YesNoPills summary={summary} total={total} />}
            {q.type === 'scale' && <ScaleDisplay summary={summary} />}
            {q.type === 'open' && <OpenEndedDisplay summary={summary} />}
          </>
        )}

        {summary.count > 0 && (
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

export function ScriptResponsesTab({
  eligibleRecords,
  totalRouted: _totalRouted,
}: ScriptResponsesTabProps) {
  const data = useMemo(
    () => derivePaymentExperienceScriptData(eligibleRecords, _totalRouted),
    [eligibleRecords, _totalRouted],
  );
  const [highlightedOrder, setHighlightedOrder] = useState<number | null>(null);

  const handleJump = (orderStr: string) => {
    const order = Number(orderStr);
    if (!order) return;
    const el = document.getElementById(`pe-question-${order}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlightedOrder(order);
    window.setTimeout(() => {
      setHighlightedOrder((cur) => (cur === order ? null : cur));
    }, 1600);
  };

  const totalRespondents = data.stats.respondents;

  if (totalRespondents === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No eligible Payment Experience responses to display.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Script Responses
          </h2>
          <p className="text-sm text-muted-foreground">
            Payment Experience Survey · {totalRespondents.toLocaleString()} responses ·{' '}
            {data.stats.questionCount} questions
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full md:w-auto">
          <select
            className="h-9 w-full sm:w-72 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            defaultValue=""
            onChange={(e) => {
              handleJump(e.target.value);
              e.currentTarget.value = '';
            }}
            aria-label="Jump to question"
          >
            <option value="" disabled>
              Jump to question…
            </option>
            {data.questions.map((qs) => {
              const text = qs.question.text;
              const truncated = text.length > 56 ? text.slice(0, 55) + '…' : text;
              return (
                <option key={qs.question.order} value={qs.question.order}>
                  Q{qs.question.order}: {truncated}
                </option>
              );
            })}
          </select>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 w-full sm:w-auto"
            onClick={() => downloadPaymentExperienceScriptCsv(data)}
          >
            <Download className="w-3.5 h-3.5" />
            Download Report
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Completion Rate"
          value={`${Math.round(data.stats.completionRate)}%`}
        />
        <StatCard
          label="Avg Questions Answered"
          value={`${data.stats.avgQuestionsAnswered.toFixed(1)} / ${data.stats.questionCount}`}
        />
        <StatCard
          label="Respondents"
          value={data.stats.respondents.toLocaleString()}
        />
        <StatCard
          label="Latest Response"
          value={formatDate(data.stats.latestResponseAt)}
        />
      </div>

      {/* Question cards */}
      <div className="space-y-3">
        {data.questions.map((qs) => (
          <QuestionCard
            key={qs.question.order}
            summary={qs}
            total={totalRespondents}
            highlighted={highlightedOrder === qs.question.order}
          />
        ))}
      </div>
    </div>
  );
}
