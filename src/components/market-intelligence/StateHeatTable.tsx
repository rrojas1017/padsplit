import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarketStateData, MarketCityData } from '@/hooks/useMarketIntelligence';
import { CityDrillDown } from './CityDrillDown';

type SortKey = 'state' | 'total' | 'bookings' | 'nonBookings' | 'conversionRate' | 'churnRate' | 'avgCallDuration' | 'dominantSentiment';

interface StateHeatTableProps {
  stateData: MarketStateData[];
  cityData: MarketCityData[];
}

const getConversionColor = (rate: number) => {
  if (rate >= 25) return 'bg-success/20 text-success';
  if (rate >= 15) return 'bg-warning/20 text-warning';
  return 'bg-destructive/20 text-destructive';
};

const getChurnColor = (rate: number) => {
  if (rate <= 15) return 'text-success';
  if (rate <= 30) return 'text-warning';
  return 'text-destructive';
};

const getSentimentColor = (sentiment: string) => {
  if (sentiment === 'positive') return 'text-success';
  if (sentiment === 'negative') return 'text-destructive';
  if (sentiment === 'mixed') return 'text-warning';
  return 'text-muted-foreground';
};

export function StateHeatTable({ stateData, cityData }: StateHeatTableProps) {
  const [expandedState, setExpandedState] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...stateData].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const SortHeader = ({ label, sortKey: sk }: { label: string; sortKey: SortKey }) => (
    <th
      className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors group select-none"
      onClick={() => handleSort(sk)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === sk ? (
          sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
        )}
      </div>
    </th>
  );

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">State Performance Heat Map</h3>
        <p className="text-sm text-muted-foreground">{stateData.length} states • Click a row to drill into cities</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-8 px-2" />
              <SortHeader label="State" sortKey="state" />
              <SortHeader label="Total" sortKey="total" />
              <SortHeader label="Bookings" sortKey="bookings" />
              <SortHeader label="Non-Bookings" sortKey="nonBookings" />
              <SortHeader label="Conversion %" sortKey="conversionRate" />
              <SortHeader label="Churn %" sortKey="churnRate" />
              <SortHeader label="Avg Call (s)" sortKey="avgCallDuration" />
              <SortHeader label="Sentiment" sortKey="dominantSentiment" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isExpanded = expandedState === row.state;
              const cities = cityData.filter(c => c.state === row.state);
              return (
                <> 
                  <tr
                    key={row.state}
                    className={cn(
                      "border-b border-border cursor-pointer transition-colors hover:bg-muted/30",
                      isExpanded && "bg-muted/20"
                    )}
                    onClick={() => setExpandedState(isExpanded ? null : row.state)}
                  >
                    <td className="px-2 py-3">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">{row.state}</td>
                    <td className="py-3 px-4 text-foreground font-semibold">{row.total.toLocaleString()}</td>
                    <td className="py-3 px-4 text-foreground">{row.bookings.toLocaleString()}</td>
                    <td className="py-3 px-4 text-muted-foreground">{row.nonBookings.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", getConversionColor(row.conversionRate))}>
                        {row.conversionRate}%
                      </span>
                    </td>
                    <td className={cn("py-3 px-4 font-medium", getChurnColor(row.churnRate))}>
                      {row.churnRate}%
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {row.avgCallDuration > 0 ? `${Math.round(row.avgCallDuration / 60)}m ${row.avgCallDuration % 60}s` : '—'}
                    </td>
                    <td className={cn("py-3 px-4 capitalize font-medium", getSentimentColor(row.dominantSentiment))}>
                      {row.dominantSentiment}
                    </td>
                  </tr>
                  {isExpanded && cities.length > 0 && (
                    <tr key={`${row.state}-cities`}>
                      <td colSpan={9} className="p-0 bg-muted/10">
                        <CityDrillDown cities={cities} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
