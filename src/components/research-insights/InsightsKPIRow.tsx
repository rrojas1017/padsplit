import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, Target, TrendingUp, AlertTriangle, Users } from 'lucide-react';

interface KPIValues {
  totalCases: number;
  preventablePercent: number;
  topReasonCode: string;
  flaggedForReview: number;
  avgPreventability: number;
}

function kpiColor(value: number, redThreshold: number, amberThreshold: number) {
  if (value >= redThreshold) return 'text-destructive';
  if (value >= amberThreshold) return 'text-amber-500';
  return 'text-emerald-500';
}

export function InsightsKPIRow({ kpis }: { kpis: KPIValues }) {
  const cards = [
    {
      label: 'Total Cases',
      value: kpis.totalCases.toLocaleString(),
      icon: BarChart3,
      color: 'text-primary',
    },
    {
      label: 'Preventable %',
      value: `${kpis.preventablePercent.toFixed(0)}%`,
      icon: Target,
      color: kpiColor(kpis.preventablePercent, 50, 30),
    },
    {
      label: 'Top Reason',
      value: kpis.topReasonCode,
      icon: TrendingUp,
      color: 'text-primary',
      truncate: true,
    },
    {
      label: 'Flagged for Review',
      value: kpis.flaggedForReview.toLocaleString(),
      icon: AlertTriangle,
      color: kpis.flaggedForReview > 0 ? 'text-amber-500' : 'text-emerald-500',
    },
    {
      label: 'Avg Preventability',
      value: kpis.avgPreventability > 0 ? kpis.avgPreventability.toFixed(1) : '—',
      icon: Users,
      color: kpiColor(kpis.avgPreventability, 7, 4),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {cards.map((card) => (
        <Card key={card.label} className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-lg font-bold ${card.color} ${card.truncate ? 'truncate' : ''}`}>
                {card.value}
              </p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
