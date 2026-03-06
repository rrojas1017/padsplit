import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';

interface FrictionPoint {
  point: string;
  description?: string;
  quote?: string;
  impact?: string;
}

interface PaymentFrictionProps {
  data: {
    summary?: string;
    key_friction_points?: FrictionPoint[];
    key_failures?: string[];
    recommendation?: string;
    // Legacy
    payment_related_moveouts?: number;
    payment_related_pct?: number;
    saveable_with_extension?: number;
    saveable_pct?: number;
  };
}

function ImpactBadge({ impact }: { impact?: string }) {
  if (!impact) return null;
  const l = impact.toLowerCase();
  if (l === 'critical') return <Badge variant="destructive">Critical</Badge>;
  if (l === 'high') return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">High</Badge>;
  return <Badge variant="outline">{impact}</Badge>;
}

export function PaymentFrictionCard({ data }: PaymentFrictionProps) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-blue-500" />
          Payment Friction Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">{data.summary}</p>
        )}

        {data.key_friction_points?.length ? (
          <div className="space-y-3">
            {data.key_friction_points.map((fp, i) => (
              <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{fp.point}</p>
                  <ImpactBadge impact={fp.impact} />
                </div>
                {fp.description && <p className="text-xs text-muted-foreground">{fp.description}</p>}
                {fp.quote && (
                  <blockquote className="border-l-2 border-primary/40 pl-3 italic text-xs text-muted-foreground">"{fp.quote}"</blockquote>
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

        {/* Legacy stats */}
        {data.payment_related_moveouts != null && (
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-bold text-foreground">{data.payment_related_moveouts}</p>
              <p className="text-xs text-muted-foreground">Payment-related ({data.payment_related_pct?.toFixed(0)}%)</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-500/10">
              <p className="text-lg font-bold text-emerald-600">{data.saveable_with_extension}</p>
              <p className="text-xs text-muted-foreground">Saveable ({data.saveable_pct?.toFixed(0)}%)</p>
            </div>
          </div>
        )}

        {data.recommendation && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Recommendation</p>
            <p className="text-sm text-foreground">{data.recommendation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
