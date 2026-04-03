import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, Target, TrendingUp, Home, DollarSign, HeartCrack } from 'lucide-react';
import { formatPercent, formatCount } from './utils';
import type { ExtendedKPIs } from '@/components/research-insights/InsightsKPIRow';

interface MoveOutKPIGridProps {
  kpis: ExtendedKPIs;
}

export function MoveOutKPIGrid({ kpis }: MoveOutKPIGridProps) {
  const totalDisplay = kpis.dataErrorCount > 0
    ? (kpis.totalCases - kpis.dataErrorCount).toLocaleString()
    : kpis.totalCases > 0 ? kpis.totalCases.toLocaleString() : '—';

  const processedLabel = kpis.processedRecords
    ? `of ${kpis.processedRecords.toLocaleString()} records`
    : 'for selected period';

  // Compute addressable count from percentage and total
  const addressablePctNum = parseFloat(String(kpis.addressablePct).replace(/%/g, ''));
  const addressableCount = !isNaN(addressablePctNum) && kpis.totalCases > 0
    ? Math.round((addressablePctNum > 1 ? addressablePctNum / 100 : addressablePctNum) * kpis.totalCases)
    : null;

  const topReasonName = kpis.topReasonCode || '—';
  const isLongName = topReasonName.length > 25;

  // Compute top reason count and formatted percentage
  const topReasonPctRaw = parseFloat(String(kpis.topReasonPct || '0').replace(/%/g, ''));
  const topReasonCount = !isNaN(topReasonPctRaw) && kpis.totalCases > 0
    ? Math.round((topReasonPctRaw > 1 ? topReasonPctRaw / 100 : topReasonPctRaw) * kpis.totalCases)
    : null;

  const cards = [
    {
      value: totalDisplay,
      label: 'Total Cases',
      context: processedLabel,
      icon: BarChart3,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      value: formatPercent(kpis.addressablePct),
      label: 'Addressable',
      context: addressableCount ? `${addressableCount} addressable cases` : processedLabel,
      icon: Target,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
    },
    {
      value: topReasonName,
      label: 'Top Reason',
      context: kpis.topReasonPct ? `${kpis.topReasonPct} of cases` : 'most frequent',
      icon: TrendingUp,
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
      isLargeText: isLongName,
    },
    {
      value: formatPercent(kpis.hostRelatedPct),
      label: 'Host Related',
      context: 'property & host issues',
      icon: Home,
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
    },
    {
      value: kpis.highRegretPct ? formatPercent(kpis.highRegretPct) : '—',
      label: 'High Regret',
      context: 'members who regret leaving',
      icon: HeartCrack,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
    },
    {
      value: kpis.paymentRelatedPct ? formatPercent(kpis.paymentRelatedPct) : '—',
      label: 'Payment Related',
      context: 'payment friction cases',
      icon: DollarSign,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${card.iconBg}`}>
                <card.icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            </div>
            <p className={`font-bold text-foreground ${card.isLargeText ? 'text-xl' : 'text-3xl'}`}>
              {card.value}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{card.context}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
