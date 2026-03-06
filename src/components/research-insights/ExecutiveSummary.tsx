import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Sparkles } from 'lucide-react';

interface ExecutiveSummaryProps {
  data: {
    title?: string;
    headline?: string;
    key_finding?: string;
    quantified_impact?: string;
    urgent_recommendation?: string;
    period?: string;
    date_range?: string;
    // Legacy numeric fields (fallback)
    total_cases?: number;
    addressable_pct?: number;
    avg_preventability_score?: number;
    high_regret_count?: number;
    high_regret_pct?: number;
    payment_related_pct?: number;
    host_related_pct?: number;
    roommate_related_pct?: number;
    life_event_pct?: number;
    non_addressable_pct?: number;
    partially_addressable_pct?: number;
  };
}

export function ExecutiveSummary({ data }: ExecutiveSummaryProps) {
  const isNarrative = !!(data.key_finding || data.title);

  if (isNarrative) {
    return (
      <div className="space-y-4">
        {/* Main headline card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-foreground leading-snug">
                  {data.title || data.headline}
                </h2>
                {data.period && (
                  <Badge variant="outline">{data.period}</Badge>
                )}
              </div>
            </div>

            {data.key_finding && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {data.key_finding}
              </p>
            )}

            {data.quantified_impact && (
              <div className="bg-background/80 rounded-lg p-4 border border-border">
                <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Quantified Impact</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{data.quantified_impact}</p>
              </div>
            )}

            {data.urgent_recommendation && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-destructive mb-1 uppercase tracking-wide">Urgent Recommendation</p>
                  <p className="text-sm text-foreground leading-relaxed">{data.urgent_recommendation}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Legacy stat-tile layout
  const stats = [
    { label: 'Total Cases', value: data.total_cases },
    { label: 'Addressable', value: data.addressable_pct ? `${data.addressable_pct.toFixed(0)}%` : undefined },
    { label: 'Avg Preventability', value: data.avg_preventability_score ? `${data.avg_preventability_score.toFixed(1)}/10` : undefined },
    { label: 'High Regret', value: data.high_regret_count != null ? `${data.high_regret_count} (${data.high_regret_pct?.toFixed(0)}%)` : undefined },
    { label: 'Payment Related', value: data.payment_related_pct ? `${data.payment_related_pct.toFixed(0)}%` : undefined },
    { label: 'Host Related', value: data.host_related_pct ? `${data.host_related_pct.toFixed(0)}%` : undefined },
  ].filter(s => s.value != null);

  return (
    <div className="space-y-4">
      {data.headline && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
          <p className="text-lg font-semibold text-foreground leading-relaxed">{data.headline}</p>
        </div>
      )}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
