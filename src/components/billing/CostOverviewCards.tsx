import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Zap, Clock } from 'lucide-react';
import { formatCurrency } from '@/utils/billingCalculations';
import { CostSummary, ApiCost, DateRangeType } from '@/hooks/useBillingData';

interface CostOverviewCardsProps {
  summary: CostSummary;
  costs: ApiCost[];
  dateRange: DateRangeType;
}

const CostOverviewCards = ({ summary, costs, dateRange }: CostOverviewCardsProps) => {
  const elevenlabsCost = summary.byProvider['elevenlabs'] || 0;
  const lovableAICost = summary.byProvider['lovable_ai'] || 0;
  const totalCalls = costs.length;
  const avgCostPerCall = totalCalls > 0 ? summary.totalCost / totalCalls : 0;

  const cards = [
    {
      title: 'Total Costs',
      value: formatCurrency(summary.totalCost),
      subtitle: `${totalCalls} API calls`,
      icon: DollarSign,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'ElevenLabs',
      value: formatCurrency(elevenlabsCost),
      subtitle: 'TTS + STT',
      icon: Zap,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Lovable AI',
      value: formatCurrency(lovableAICost),
      subtitle: 'AI Analysis',
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Avg Cost/Call',
      value: formatCurrency(avgCostPerCall),
      subtitle: 'Per API request',
      icon: Clock,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default CostOverviewCards;
