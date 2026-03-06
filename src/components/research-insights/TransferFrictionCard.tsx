import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft } from 'lucide-react';

interface FrictionPoint {
  point: string;
  description?: string;
  quote?: string;
  impact?: string;
}

interface TransferFrictionProps {
  data: {
    summary?: string;
    key_friction_points?: FrictionPoint[];
    key_failures?: string[];
    recommendation?: string;
    considered_transfer?: number;
    considered_transfer_pct?: number;
    unaware_of_option?: number;
    unaware_pct?: number;
    blocked_by_balance?: number;
    blocked_by_availability?: number;
    transfer_would_have_retained?: number;
  };
}

function getImpactBorderColor(impact?: string): string {
  if (!impact) return 'hsl(var(--border))';
  const l = impact.toLowerCase();
  if (l === 'critical') return 'hsl(var(--destructive))';
  if (l === 'high') return 'hsl(45, 93%, 47%)';
  return 'hsl(var(--border))';
}

function ImpactBadge({ impact }: { impact?: string }) {
  if (!impact) return null;
  const l = impact.toLowerCase();
  if (l === 'critical') return <Badge variant="destructive">Critical</Badge>;
  if (l === 'high') return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">High</Badge>;
  return <Badge variant="outline">{impact}</Badge>;
}

export function TransferFrictionCard({ data }: TransferFrictionProps) {
  if (!data) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center">
            <ArrowRightLeft className="w-4 h-4 text-violet-500" />
          </div>
          Transfer Friction Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">{data.summary}</p>
        )}

        {data.key_friction_points?.length ? (
          <div className="space-y-3">
            {data.key_friction_points.map((fp, i) => (
              <div
                key={i}
                className="border border-border rounded-lg p-3 space-y-2"
                style={{ borderLeftWidth: '4px', borderLeftColor: getImpactBorderColor(fp.impact) }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{fp.point}</p>
                  <ImpactBadge impact={fp.impact} />
                </div>
                {fp.description && <p className="text-xs text-muted-foreground">{fp.description}</p>}
                {fp.quote && (
                  <blockquote className="border-l-2 border-accent pl-3 italic text-xs text-muted-foreground">"{fp.quote}"</blockquote>
                )}
              </div>
            ))}
          </div>
        ) : data.key_failures?.length ? (
          <ul className="space-y-1.5">
            {data.key_failures.map((f, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                <span className="text-destructive mt-1">•</span>{f}
              </li>
            ))}
          </ul>
        ) : null}

        {data.considered_transfer != null && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-muted/30 to-muted/60 border border-border">
              <p className="text-lg font-bold text-foreground">{data.considered_transfer}</p>
              <p className="text-xs text-muted-foreground">Considered ({data.considered_transfer_pct?.toFixed(0)}%)</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-destructive/5 to-destructive/15 border border-destructive/20">
              <p className="text-lg font-bold text-destructive">{data.unaware_of_option}</p>
              <p className="text-xs text-muted-foreground">Unaware ({data.unaware_pct?.toFixed(0)}%)</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-muted/30 to-muted/60 border border-border">
              <p className="text-lg font-bold text-foreground">{data.blocked_by_balance}</p>
              <p className="text-xs text-muted-foreground">Blocked by Balance</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-emerald-500/5 to-emerald-500/15 border border-emerald-500/20">
              <p className="text-lg font-bold text-emerald-600">{data.transfer_would_have_retained}</p>
              <p className="text-xs text-muted-foreground">Would Have Retained</p>
            </div>
          </div>
        )}

        {data.recommendation && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Recommendation</p>
            <p className="text-sm text-foreground">{data.recommendation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
