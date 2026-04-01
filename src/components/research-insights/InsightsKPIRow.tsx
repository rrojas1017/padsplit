import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart3, Target, TrendingUp, AlertTriangle, Home } from 'lucide-react';
import type { DerivedKPIs } from '@/types/research-insights';

export function InsightsKPIRow({ kpis }: { kpis: DerivedKPIs }) {
  const cards = [
    {
      label: 'Total Cases',
      value: kpis.totalCases > 0 ? kpis.totalCases.toLocaleString() : 'N/A',
      icon: BarChart3,
      color: 'text-primary',
    },
    {
      label: 'Addressable %',
      value: kpis.addressablePct !== 'N/A' ? kpis.addressablePct : 'N/A',
      icon: Target,
      color: 'text-emerald-500',
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
      label: 'Host Related',
      value: kpis.hostRelatedPct !== 'N/A' ? kpis.hostRelatedPct : 'N/A',
      icon: Home,
      color: 'text-destructive',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {cards.map((card) => (
        <Card key={card.label} className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className="min-w-0">
              {card.truncate ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className={`text-lg font-bold ${card.color} truncate max-w-[140px]`}>
                        {card.value}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-sm">{card.value}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <p className={`text-lg font-bold ${card.color}`}>
                  {card.value}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
