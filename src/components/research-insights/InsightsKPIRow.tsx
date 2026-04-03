import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, Target, TrendingUp, Home, DollarSign, HeartCrack } from 'lucide-react';
import type { DerivedKPIs } from '@/types/research-insights';

export interface ExtendedKPIs extends DerivedKPIs {
  highRegretPct?: string;
  paymentRelatedPct?: string;
  processedRecords?: number;
  topReasonPct?: string;
}

interface InsightsKPIRowProps {
  kpis: ExtendedKPIs;
}

/** Format a percentage value — handles raw decimals (0.605 → "60.5%") and string ranges ("60-70%") */
export function formatPercent(val: string): string {
  if (!val || val === 'N/A') return 'N/A';
  if (val.includes('%')) return val;
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return `${Math.round(pct * 10) / 10}%`;
}

export function InsightsKPIRow({ kpis }: InsightsKPIRowProps) {
  const totalDisplay = kpis.dataErrorCount > 0
    ? `${(kpis.totalCases - kpis.dataErrorCount).toLocaleString()}`
    : kpis.totalCases > 0 ? kpis.totalCases.toLocaleString() : 'N/A';

  const processedLabel = kpis.processedRecords
    ? `of ${kpis.processedRecords.toLocaleString()} records`
    : 'for selected period';

  const cards = [
    {
      value: totalDisplay,
      label: 'Total Cases',
      context: processedLabel,
      icon: BarChart3,
      accentClass: 'text-primary bg-primary/10',
    },
    {
      value: kpis.addressablePct !== 'N/A' ? formatPercent(kpis.addressablePct) : 'N/A',
      label: 'Addressable',
      context: processedLabel,
      icon: Target,
      accentClass: 'text-emerald-600 bg-emerald-500/10',
    },
    {
      value: kpis.topReasonCode,
      label: 'Top Reason',
      context: kpis.topReasonPct ? `${kpis.topReasonPct} of cases` : 'most frequent',
      icon: TrendingUp,
      accentClass: 'text-destructive bg-destructive/10',
      truncate: true,
    },
    {
      value: kpis.hostRelatedPct !== 'N/A' ? formatPercent(kpis.hostRelatedPct) : 'N/A',
      label: 'Host Related',
      context: 'property & host issues',
      icon: Home,
      accentClass: 'text-destructive bg-destructive/10',
    },
    {
      value: kpis.highRegretPct ? formatPercent(kpis.highRegretPct) : 'N/A',
      label: 'High Regret',
      context: 'members who regret leaving',
      icon: HeartCrack,
      accentClass: 'text-amber-600 bg-amber-500/10',
    },
    {
      value: kpis.paymentRelatedPct ? formatPercent(kpis.paymentRelatedPct) : 'N/A',
      label: 'Payment Related',
      context: 'payment friction cases',
      icon: DollarSign,
      accentClass: 'text-amber-600 bg-amber-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${card.accentClass}`}>
                <card.icon className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            </div>
            <p className={`text-2xl font-bold text-foreground ${card.truncate ? 'truncate' : ''}`}>
              {card.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{card.context}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
