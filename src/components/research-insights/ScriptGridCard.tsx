// CR-013 D: one card per grid block — per-row 100%-stacked bars.
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { ScriptSurveyRecord } from '@/hooks/useScriptSurveyResponses';
import { buildGridModel, GRID_OTHER, type SurveyBlock } from '@/utils/scriptSurveyGrid';

// Ordered ramp: strongest column first, fading toward the weakest.
const RAMP = [1, 0.75, 0.55, 0.4, 0.28, 0.18, 0.12];

function segStyle(label: string, i: number): React.CSSProperties {
  if (label === GRID_OTHER) return { backgroundColor: 'hsl(var(--muted-foreground) / 0.35)' };
  return { backgroundColor: `hsl(var(--primary) / ${RAMP[Math.min(i, RAMP.length - 1)]})` };
}

export function ScriptGridCard({ block, eligible }: { block: Extract<SurveyBlock, { kind: 'grid' }>; eligible: ScriptSurveyRecord[] }) {
  const model = useMemo(() => buildGridModel(block, eligible), [block, eligible]);
  return (
    <Card className="lg:col-span-2">
      <CardContent className="p-5 space-y-4">
        <p className="text-sm font-medium text-foreground leading-snug">{model.title}</p>
        <div className="flex flex-wrap gap-3">
          {model.columns.map((c, i) => (
            <span key={c} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm" style={segStyle(c, i)} />
              {c}
            </span>
          ))}
        </div>
        <div className="space-y-2.5">
          {model.rows.map((r) => (
            <div key={r.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-2 sm:gap-3">
              <span className="text-sm text-foreground truncate" title={r.label}>{r.label}</span>
              <div className="flex h-6 w-full overflow-hidden rounded bg-muted">
                {r.n > 0 && r.segments.map((s, i) => s.pct > 0 && (
                  <div
                    key={s.label}
                    className="flex items-center justify-center text-[11px] font-medium text-primary-foreground"
                    style={{ ...segStyle(s.label, i), width: `${s.pct}%` }}
                    title={`${s.label}: ${s.count} (${s.pct.toFixed(1)}%)`}
                  >
                    {s.pct >= 6 ? `${Math.round(s.pct)}%` : ''}
                  </div>
                ))}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">n = {r.n}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
