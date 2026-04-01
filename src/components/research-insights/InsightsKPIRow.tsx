import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart3, Target, TrendingUp, AlertTriangle, Home, ArrowUp, ArrowDown, Minus, HelpCircle } from 'lucide-react';
import type { DerivedKPIs } from '@/types/research-insights';
import type { TrendDirection } from '@/hooks/useResearchTrends';

interface InsightsKPIRowProps {
  kpis: DerivedKPIs;
  direction?: TrendDirection | null;
}

export function InsightsKPIRow({ kpis, direction }: InsightsKPIRowProps) {
  const totalDisplay = kpis.dataErrorCount > 0
    ? `${(kpis.totalCases - kpis.dataErrorCount).toLocaleString()}`
    : kpis.totalCases > 0 ? kpis.totalCases.toLocaleString() : 'N/A';
  const totalSubtext = kpis.dataErrorCount > 0
    ? `${kpis.dataErrorCount} data errors excluded`
    : undefined;

  const cards = [
    {
      label: 'Total Cases',
      value: totalDisplay,
      subtext: totalSubtext,
      icon: BarChart3,
      color: 'text-primary',
      trend: direction ? { dir: direction.totalCases, delta: direction.totalCasesDelta } : null,
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
                      <p className={`text-sm font-bold ${card.color} truncate max-w-[140px] leading-tight`}>
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
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                {'trend' in card && card.trend && (
                  <span className={`inline-flex items-center text-[10px] font-medium ${
                    card.trend.dir === 'up' ? 'text-emerald-500' : card.trend.dir === 'down' ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                    {card.trend.dir === 'up' ? <ArrowUp className="w-3 h-3" /> : card.trend.dir === 'down' ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {card.trend.delta !== 0 && (
                      <span>{card.trend.delta > 0 ? '+' : ''}{card.trend.delta}</span>
                    )}
                  </span>
                )}
              </div>
              {'subtext' in card && card.subtext && (
                <p className="text-[10px] text-muted-foreground">{card.subtext}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
