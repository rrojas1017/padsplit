import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useMarketIntelligence } from '@/hooks/useMarketIntelligence';
import { StateHeatTable } from '@/components/market-intelligence/StateHeatTable';
import { MarketComparisonCards } from '@/components/market-intelligence/MarketComparisonCards';
import { DateRangeFilter, DateFilterValue, CustomDateRange } from '@/components/dashboard/DateRangeFilter';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { RefreshCw, Map, Clock } from 'lucide-react';
import { format } from 'date-fns';

type DateRange = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'all' | 'custom';

const getDateRange = (range: DateRange, custom?: CustomDateRange) => {
  const now = new Date();
  switch (range) {
    case 'today': return { from: format(now, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') };
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: format(y, 'yyyy-MM-dd'), to: format(y, 'yyyy-MM-dd') };
    }
    case '7d': {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      return { from: format(d, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') };
    }
    case '30d': {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      return { from: format(d, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') };
    }
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: format(d, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') };
    }
    case 'custom':
      if (custom?.from && custom?.to) return { from: format(custom.from, 'yyyy-MM-dd'), to: format(custom.to, 'yyyy-MM-dd') };
      return { from: undefined, to: undefined };
    case 'all':
    default:
      return { from: undefined, to: undefined };
  }
};

export default function MarketIntelligence() {
  usePageTracking('view_market_intelligence');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [customDates, setCustomDates] = useState<CustomDateRange | undefined>();
  const [minRecords, setMinRecords] = useState(3);

  const { from, to } = getDateRange(dateRange, customDates);
  const { stateData, cityData, topMarkets, systemAvgConversion, generatedAt, fromCache, isLoading, isRefreshing, refresh } = useMarketIntelligence(from, to, minRecords);

  const handleRangeChange = (range: DateFilterValue, dates?: CustomDateRange) => {
    setDateRange(range as DateRange);
    setCustomDates(range === 'custom' && dates ? dates : undefined);
  };

  return (
    <DashboardLayout
      title="Market Intelligence"
      subtitle="Geographic performance across all markets"
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <DateRangeFilter onRangeChange={handleRangeChange} includeAllTime={true} includeCustom={true} />
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Min records:</span>
          <Slider
            value={[minRecords]}
            onValueChange={([v]) => setMinRecords(v)}
            min={1}
            max={20}
            step={1}
            className="w-32"
          />
          <span className="text-sm font-medium text-foreground w-6">{minRecords}</span>
        </div>

        <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        {generatedAt && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
            <Clock className="w-3 h-3" />
            {fromCache ? 'Cached' : 'Fresh'} • {format(new Date(generatedAt), 'HH:mm:ss')}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="text-xs text-muted-foreground font-medium uppercase">States</p>
              <p className="text-2xl font-bold text-foreground">{stateData.length}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="text-xs text-muted-foreground font-medium uppercase">Cities</p>
              <p className="text-2xl font-bold text-foreground">{cityData.length}</p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="text-xs text-muted-foreground font-medium uppercase">Total Records</p>
              <p className="text-2xl font-bold text-foreground">
                {stateData.reduce((s, d) => s + d.total, 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="text-xs text-muted-foreground font-medium uppercase">Avg Conversion</p>
              <p className="text-2xl font-bold text-foreground">{systemAvgConversion}%</p>
            </div>
          </div>

          {/* Top Markets */}
          <MarketComparisonCards topMarkets={topMarkets} systemAvgConversion={systemAvgConversion} />

          {/* State Heat Table */}
          <StateHeatTable stateData={stateData} cityData={cityData} />
        </div>
      )}
    </DashboardLayout>
  );
}
