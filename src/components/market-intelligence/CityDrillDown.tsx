import { cn } from '@/lib/utils';
import { MarketCityData } from '@/hooks/useMarketIntelligence';

interface CityDrillDownProps {
  cities: MarketCityData[];
}

const getConversionColor = (rate: number) => {
  if (rate >= 25) return 'bg-success/20 text-success';
  if (rate >= 15) return 'bg-warning/20 text-warning';
  return 'bg-destructive/20 text-destructive';
};

export function CityDrillDown({ cities }: CityDrillDownProps) {
  return (
    <div className="p-4 pl-10 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {cities.length} Cities
      </p>
      <div className="grid gap-2">
        {cities.map((city) => (
          <div key={`${city.state}-${city.city}`} className="flex items-start gap-4 p-3 rounded-lg bg-card border border-border">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-medium text-foreground text-sm">{city.city}</span>
                <span className="text-xs text-muted-foreground">{city.total} records</span>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", getConversionColor(city.conversionRate))}>
                  {city.conversionRate}% conv.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>{city.bookings} bookings • {city.nonBookings} non-bookings</span>
                {city.avgBuyerIntent !== null && (
                  <span>Intent: <span className="text-foreground font-medium">{city.avgBuyerIntent}/100</span></span>
                )}
                {city.avgWeeklyBudget !== null && (
                  <span>Avg Budget: <span className="text-foreground font-medium">${city.avgWeeklyBudget}/wk</span></span>
                )}
                {city.avgCallDuration > 0 && (
                  <span>Avg Call: {Math.round(city.avgCallDuration / 60)}m</span>
                )}
              </div>
              {city.topObjections.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {city.topObjections.slice(0, 3).map((obj) => (
                    <span key={obj.label} className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs">
                      {obj.label} ({obj.count})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
