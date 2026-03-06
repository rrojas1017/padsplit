import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, AlertTriangle } from 'lucide-react';

interface PaymentFrictionProps {
  data: {
    // New narrative format
    summary?: string;
    key_failures?: string[];
    recommendation?: string;
    // Legacy stat format
    payment_related_moveouts?: number;
    payment_related_pct?: number;
    saveable_with_extension?: number;
    saveable_pct?: number;
    extension_awareness_gap?: boolean;
    extension_process_failures?: string[];
    miscommunication_incidents?: number;
    third_party_payment_signals?: number;
  };
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

        {data.key_failures?.length ? (
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">Key Failures</p>
            <ul className="space-y-2">
              {data.key_failures.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : data.extension_process_failures?.length ? (
          <div>
            <p className="text-xs font-medium text-foreground mb-1">Process Failures:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {data.extension_process_failures.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-destructive mt-1">•</span>{f}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Legacy stats */}
        {data.payment_related_moveouts != null && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
