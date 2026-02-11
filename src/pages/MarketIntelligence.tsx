import { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useMarketIntelligence } from '@/hooks/useMarketIntelligence';
import { StateHeatTable } from '@/components/market-intelligence/StateHeatTable';
import { MarketComparisonCards } from '@/components/market-intelligence/MarketComparisonCards';
import { DateRangeFilter, DateFilterValue, CustomDateRange } from '@/components/dashboard/DateRangeFilter';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Map, Clock, Database } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

  // Backfill state
  const [unmappedCount, setUnmappedCount] = useState<number | null>(null);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillProcessed, setBackfillProcessed] = useState(0);
  const [backfillTotal, setBackfillTotal] = useState(0);
  const abortRef = useRef(false);

  const { from, to } = getDateRange(dateRange, customDates);
  const { stateData, cityData, topMarkets, systemAvgConversion, systemAvgBudget, generatedAt, fromCache, isLoading, isRefreshing, refresh } = useMarketIntelligence(from, to, minRecords);

  // Fetch unmapped count on mount
  useEffect(() => {
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('transcription_status', 'completed')
      .eq('market_backfill_checked', false)
      .is('market_city', null)
      .then(({ count }) => setUnmappedCount(count ?? 0));
  }, []);

  const runBackfill = useCallback(async () => {
    abortRef.current = false;
    setBackfillRunning(true);
    setBackfillProcessed(0);
    setBackfillTotal(unmappedCount || 0);
    let totalProcessed = 0;

    try {
      while (!abortRef.current) {
        const { data, error } = await supabase.functions.invoke('backfill-markets-from-transcriptions', {
          body: { batchSize: 50 },
        });

        if (error) throw error;
        
        totalProcessed += data.processed || 0;
        setBackfillProcessed(totalProcessed);

        if (!data.remaining || data.remaining <= 0) break;

        // Brief delay between batches
        await new Promise(r => setTimeout(r, 2000));
      }

      toast({ title: 'Backfill Complete', description: `Processed ${totalProcessed} records` });
      setUnmappedCount(0);
      refresh();
    } catch (err: any) {
      toast({ title: 'Backfill Error', description: err.message, variant: 'destructive' });
    } finally {
      setBackfillRunning(false);
    }
  }, [unmappedCount, refresh]);

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
        <DateRangeFilter onRangeChange={handleRangeChange} includeAllTime={true} includeCustom={true} defaultValue="all" />
        
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

        {unmappedCount !== null && unmappedCount > 0 && !backfillRunning && (
          <Button variant="secondary" size="sm" onClick={runBackfill} className="gap-2">
            <Database className="w-4 h-4" />
            Backfill Markets ({unmappedCount.toLocaleString()})
          </Button>
        )}

        {generatedAt && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
            <Clock className="w-3 h-3" />
            {fromCache ? 'Cached' : 'Fresh'} • {format(new Date(generatedAt), 'HH:mm:ss')}
          </span>
        )}
      </div>

      {backfillRunning && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg border border-border">
          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-foreground font-medium">Backfilling market data…</span>
              <span className="text-muted-foreground">{backfillProcessed} / {backfillTotal}</span>
            </div>
            <Progress value={backfillTotal > 0 ? (backfillProcessed / backfillTotal) * 100 : 0} className="h-2" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => { abortRef.current = true; }}>Stop</Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="text-xs text-muted-foreground font-medium uppercase">Avg Weekly Budget</p>
              <p className="text-2xl font-bold text-foreground">{systemAvgBudget !== null ? `$${systemAvgBudget}` : '—'}</p>
            </div>
          </div>

          {/* Top Markets */}
          <MarketComparisonCards topMarkets={topMarkets} systemAvgConversion={systemAvgConversion} systemAvgBudget={systemAvgBudget} />

          {/* State Heat Table */}
          <StateHeatTable stateData={stateData} cityData={cityData} />
        </div>
      )}
    </DashboardLayout>
  );
}
