// Polished dashboard card for Payment Experience topic tabs.
// Distinct from ScriptQuestionGraphCard (which still powers the unchanged
// Script Responses tab). Presentation-only: takes a derived summary, applies
// display-only normalization, and renders one of four chart variants in
// PadSplit's muted visual language.

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  applyFixedOrder,
  applyLongTail,
  normalizeAndMergeDistribution,
  type PEDistributionItem,
  type PEQuestionSummary,
} from '@/utils/paymentExperienceScriptResponses';

// Trigger one-shot mount animations (bars grow from 0 → target width, etc.).
// Returns true on the next frame after mount so initial render uses width 0.
function useMountAnimated(deps: unknown[] = []) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ready;
}


type ChartKind = 'bars' | 'donut' | 'split-pill' | 'ranked-bars';

interface TopicQuestionCardProps {
  summary: PEQuestionSummary;
  title: string;
  chart: ChartKind;
  helperText?: string;
  fixedOrder?: string[];
  maxRows?: number;
  className?: string;
  /** Forces ranked-bars when donut would be unreadable. */
  donutMinReadablePct?: number;
}

// Muted PadSplit-compatible palette (HSL). Restrained, no rainbows.
const PADSPLIT_PALETTE = [
  'hsl(217, 33%, 45%)', // slate-blue
  'hsl(160, 38%, 42%)', // emerald
  'hsl(38, 70%, 52%)',  // amber
  'hsl(265, 28%, 55%)', // muted violet
  'hsl(24, 55%, 55%)',  // muted orange
  'hsl(215, 14%, 55%)', // muted gray
  'hsl(195, 35%, 48%)', // teal-blue
];

function formatPct(p: number): string {
  // One decimal, but drop trailing .0 for cleaner display
  if (Math.abs(p - Math.round(p)) < 0.05) return `${Math.round(p)}%`;
  return `${p.toFixed(1)}%`;
}

function ariaFor(d: PEDistributionItem) {
  return `${d.label}: ${d.count} responses (${formatPct(d.percentage)})`;
}

function HorizontalBars({
  items,
  highlightTop = false,
  animKey,
}: {
  items: PEDistributionItem[];
  highlightTop?: boolean;
  animKey: string;
}) {
  const ready = useMountAnimated([animKey]);
  const max = Math.max(1, ...items.map((d) => d.percentage));
  return (
    <ul className="space-y-2.5">
      {items.map((d, i) => {
        const isTop = highlightTop && i === 0;
        const targetWidth = (d.percentage / max) * 100;
        return (
          <li
            key={d.key}
            className="space-y-1 animate-fade-in"
            style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
            aria-label={ariaFor(d)}
            title={`${d.count} responses`}
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-foreground/90" title={d.label}>
                {d.label}
              </span>
              <span
                className={cn(
                  'shrink-0 tabular-nums text-xs font-medium',
                  isTop ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {formatPct(d.percentage)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-700 ease-out',
                  isTop ? 'bg-foreground/80' : 'bg-foreground/55',
                )}
                style={{
                  width: ready ? `${targetWidth}%` : '0%',
                  transitionDelay: `${i * 50}ms`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SplitPill({ items, animKey }: { items: PEDistributionItem[]; animKey: string }) {
  const ready = useMountAnimated([animKey]);
  const yes = items.find((d) => d.key.toLowerCase() === 'yes');
  const no = items.find((d) => d.key.toLowerCase() === 'no');
  const yesPct = yes?.percentage ?? 0;
  const noPct = no?.percentage ?? 0;
  return (
    <div className="space-y-3 animate-fade-in">
      <div
        className="flex h-9 w-full overflow-hidden rounded-full border border-border bg-muted/40"
        role="img"
        aria-label={`Yes ${formatPct(yesPct)}, No ${formatPct(noPct)}`}
      >
        {yesPct > 0 && (
          <div
            className="flex items-center justify-center bg-amber-500/80 text-[11px] font-semibold text-white transition-[width] duration-700 ease-out"
            style={{ width: ready ? `${yesPct}%` : '0%' }}
            title={yes ? `Yes: ${yes.count} (${formatPct(yesPct)})` : undefined}
          >
            {ready && yesPct >= 8 && formatPct(yesPct)}
          </div>
        )}
        {noPct > 0 && (
          <div
            className="flex items-center justify-center bg-slate-500/70 text-[11px] font-semibold text-white transition-[width] duration-700 ease-out"
            style={{ width: ready ? `${noPct}%` : '0%', transitionDelay: '120ms' }}
            title={no ? `No: ${no.count} (${formatPct(noPct)})` : undefined}
          >
            {ready && noPct >= 8 && formatPct(noPct)}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/80" />
          <span className="text-foreground/90">Yes</span>
          <span className="tabular-nums text-muted-foreground">{formatPct(yesPct)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-sm bg-slate-500/70" />
          <span className="text-foreground/90">No</span>
          <span className="tabular-nums text-muted-foreground">{formatPct(noPct)}</span>
        </div>
      </div>
    </div>
  );
}

function Donut({ items, animKey }: { items: PEDistributionItem[]; animKey: string }) {
  const ready = useMountAnimated([animKey]);
  const total = items.reduce((a, d) => a + d.count, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground">No responses.</p>;

  const size = 156;
  const r = 64;
  const innerR = 38;
  const cx = size / 2;
  const cy = size / 2;
  let cursor = -Math.PI / 2;

  const slices = items.map((d, i) => {
    const frac = d.count / total;
    const start = cursor;
    const end = cursor + frac * Math.PI * 2;
    cursor = end;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const ix1 = cx + innerR * Math.cos(end);
    const iy1 = cy + innerR * Math.sin(end);
    const ix2 = cx + innerR * Math.cos(start);
    const iy2 = cy + innerR * Math.sin(start);
    const largeArc = end - start > Math.PI ? 1 : 0;
    const path =
      frac >= 0.999
        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} M ${cx - innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy} Z`
        : `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
    return { d, path, color: PADSPLIT_PALETTE[i % PADSPLIT_PALETTE.length] };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={cn(
          'shrink-0 origin-center transition-all duration-700 ease-out',
          ready ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-90 -rotate-12',
        )}
        role="img"
        aria-label="Payment method distribution"
      >
        {slices.map((s, i) => (
          <path
            key={i}
            d={s.path}
            fill={s.color}
            stroke="hsl(var(--background))"
            strokeWidth={1.5}
            className="transition-opacity duration-500"
            style={{
              opacity: ready ? 1 : 0,
              transitionDelay: `${200 + i * 60}ms`,
            }}
          >
            <title>{`${s.d.label}: ${s.d.count} (${formatPct(s.d.percentage)})`}</title>
          </path>
        ))}
      </svg>
      <ul className="flex-1 min-w-0 space-y-1.5 w-full">
        {slices.map((s, i) => (
          <li
            key={i}
            className="flex items-center gap-2 text-sm animate-fade-in"
            style={{ animationDelay: `${200 + i * 60}ms`, animationFillMode: 'both' }}
            aria-label={ariaFor(s.d)}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="truncate text-foreground/90" title={s.d.label}>
              {s.d.label}
            </span>
            <span className="ml-auto shrink-0 tabular-nums text-xs font-medium text-muted-foreground">
              {formatPct(s.d.percentage)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}


export function TopicQuestionCard({
  summary,
  title,
  chart,
  helperText,
  fixedOrder,
  maxRows,
  className,
  donutMinReadablePct = 2,
}: TopicQuestionCardProps) {
  const normalized = normalizeAndMergeDistribution(
    summary.question.id,
    summary.distribution,
    summary.count,
  );

  let items: PEDistributionItem[] = normalized;
  if (chart === 'bars' && fixedOrder) {
    items = applyFixedOrder(normalized, fixedOrder).filter((d) => d.count > 0);
  } else if (chart === 'ranked-bars' || chart === 'donut') {
    items = applyLongTail(normalized, maxRows ?? 8, summary.count);
  } else if (chart === 'bars') {
    items = [...normalized].filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  }

  // Donut guardrail: if the grouped "Other" slice or smallest slices fall
  // below the readable threshold, fall back to ranked-bars while keeping the
  // same palette and percentage-only labels.
  let effectiveChart: ChartKind = chart;
  if (chart === 'donut') {
    const other = items.find((d) => d.key === '__other__');
    const tinySlices = items.filter(
      (d) => d.key !== '__other__' && d.percentage > 0 && d.percentage < donutMinReadablePct,
    ).length;
    if ((other && other.percentage > 35) || tinySlices >= 3 || items.length < 2) {
      effectiveChart = 'ranked-bars';
    }
  }

  const isEmpty = summary.count === 0 || items.length === 0;

  const animKey = `${summary.question.id}:${items.map((d) => `${d.key}=${d.count}`).join('|')}`;

  return (
    <Card
      className={cn(
        'h-full border-border/70 bg-card shadow-sm animate-fade-in',
        className,
      )}
    >
      <CardContent className="p-5 space-y-4">
        <header className="space-y-1">
          {summary.question.section && (
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
              {summary.question.section}
            </p>
          )}
          <h3 className="text-base font-semibold text-foreground leading-snug">
            {title}
          </h3>
          {helperText && (
            <p className="text-xs text-muted-foreground/80">{helperText}</p>
          )}
        </header>

        {isEmpty ? (
          <p className="text-sm text-muted-foreground">No responses for this question.</p>
        ) : effectiveChart === 'split-pill' ? (
          <SplitPill items={items} animKey={animKey} />
        ) : effectiveChart === 'donut' ? (
          <Donut items={items} animKey={animKey} />
        ) : effectiveChart === 'ranked-bars' ? (
          <HorizontalBars items={items} highlightTop animKey={animKey} />
        ) : (
          <HorizontalBars items={items} animKey={animKey} />
        )}
      </CardContent>
    </Card>
  );

}
