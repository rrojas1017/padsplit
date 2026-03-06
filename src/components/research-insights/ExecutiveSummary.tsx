import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Sparkles, Quote } from 'lucide-react';

interface ExecutiveSummaryProps {
  data: {
    title?: string;
    headline?: string;
    key_findings?: string;
    key_finding?: string;
    period?: string;
    date_range?: string;
    recommendation_summary?: string;
    urgent_recommendation?: string;
    urgent_quote?: string;
    quantified_impact?: string;
    // Legacy
    total_cases?: number;
    addressable_pct?: number;
    avg_preventability_score?: number;
    high_regret_count?: number;
    high_regret_pct?: number;
    payment_related_pct?: number;
    host_related_pct?: number;
  };
}

export function ExecutiveSummary({ data }: ExecutiveSummaryProps) {
  const title = data.title || data.headline;
  const findings = data.key_findings || data.key_finding;
  const recommendation = data.recommendation_summary || data.urgent_recommendation;
  const period = data.period || data.date_range;

  if (title || findings) {
    return (
      <Card className="shadow-md overflow-hidden border-primary/20">
        {/* Hero banner header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 p-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-2 flex-1">
              <h2 className="text-lg font-bold text-white leading-snug">{title}</h2>
              {period && <Badge variant="outline" className="border-white/30 text-white/90 bg-white/10">{period}</Badge>}
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-4">
          {findings && (
            <p className="text-sm text-muted-foreground leading-relaxed">{findings}</p>
          )}

          {data.quantified_impact && (
            <div className="bg-muted/30 rounded-xl p-4 border border-border">
              <p className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wide">Quantified Impact</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{data.quantified_impact}</p>
            </div>
          )}

          {data.urgent_quote && (
            <div className="bg-accent/50 border border-accent rounded-xl p-4 flex items-start gap-2.5">
              <Quote className="w-4 h-4 text-accent-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm italic text-muted-foreground leading-relaxed">"{data.urgent_quote}"</p>
            </div>
          )}

          {recommendation && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-destructive mb-1 uppercase tracking-wide">Key Recommendation</p>
                <p className="text-sm text-foreground leading-relaxed">{recommendation}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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

  if (!stats.length) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
