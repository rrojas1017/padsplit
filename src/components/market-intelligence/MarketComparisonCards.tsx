import { cn } from '@/lib/utils';
import { MarketCityData } from '@/hooks/useMarketIntelligence';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MarketComparisonCardsProps {
  topMarkets: MarketCityData[];
  systemAvgConversion: number;
  systemAvgBudget: number | null;
  systemAvgQuotedPrice: number | null;
}

export function MarketComparisonCards({ topMarkets, systemAvgConversion, systemAvgBudget, systemAvgQuotedPrice }: MarketComparisonCardsProps) {
  if (topMarkets.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Top 10 Markets by Volume</h3>
        <p className="text-sm text-muted-foreground">System avg conversion: {systemAvgConversion}%</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {topMarkets.map((market, i) => {
          const diff = market.conversionRate - systemAvgConversion;
          const isAbove = diff > 0;
          const isEqual = Math.abs(diff) < 0.5;

          return (
            <div key={`${market.state}-${market.city}`} className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                <span className="font-medium text-sm text-foreground truncate">{market.city}</span>
              </div>
              <p className="text-xs text-muted-foreground">{market.state}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-lg font-bold text-foreground">{market.total}</span>
                <div className={cn("flex items-center gap-1 text-xs font-medium",
                  isEqual ? "text-muted-foreground" : isAbove ? "text-success" : "text-destructive"
                )}>
                  {isEqual ? <Minus className="w-3 h-3" /> : isAbove ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {market.conversionRate}%
                </div>
              </div>
              <div className="mt-1 text-xs font-medium space-y-0.5">
                {market.avgWeeklyBudget !== null ? (
                  <div>
                    <span className="text-muted-foreground">Budget: </span>
                    <span className={cn(
                      systemAvgBudget !== null && market.avgWeeklyBudget >= systemAvgBudget ? "text-success" : 
                      systemAvgBudget !== null ? "text-destructive" : "text-muted-foreground"
                    )}>
                      ${market.avgWeeklyBudget}/wk
                    </span>
                  </div>
                ) : (
                  <div><span className="text-muted-foreground">Budget: —</span></div>
                )}
                {market.avgQuotedPrice !== null ? (
                  <div>
                    <span className="text-muted-foreground">Quoted: </span>
                    <span className="text-foreground">${market.avgQuotedPrice}/wk</span>
                  </div>
                ) : (
                  <div><span className="text-muted-foreground">Quoted: —</span></div>
                )}
                {market.affordabilityGap !== null && (
                  <div>
                    <span className={cn(
                      "font-semibold",
                      market.affordabilityGap >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {market.affordabilityGap >= 0 ? '+' : ''}${market.affordabilityGap} gap
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
