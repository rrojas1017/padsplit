import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Heart, PawPrint, Car, Home, Phone, Briefcase, DollarSign, Truck, 
  ChevronDown, TrendingUp, BarChart3, RefreshCw, Zap, ShoppingBag,
  MapPin, Quote, AlertCircle, XCircle, Loader2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

interface CategoryData {
  category: string;
  count: number;
  topSignals: Array<{
    signal: string;
    confidence: string;
    opportunity: string;
    bookingId: string;
    marketCity: string;
    marketState: string;
    date: string;
  }>;
  topMarkets: Array<{ market: string; count: number }>;
  monthlyTrend: Array<{ month: string; count: number }>;
}

interface AggregatedData {
  totalTranscriptions: number;
  totalTranscriptionsWithSignals: number;
  totalSignals: number;
  categories: CategoryData[];
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  healthcare: { label: 'Healthcare/ACA', icon: <Heart className="h-5 w-5" />, color: 'hsl(0, 72%, 51%)', description: 'ACA enrollment, insurance needs' },
  pet: { label: 'Pet Ownership', icon: <PawPrint className="h-5 w-5" />, color: 'hsl(25, 95%, 53%)', description: 'Pet care, pet insurance' },
  transportation: { label: 'Transportation', icon: <Car className="h-5 w-5" />, color: 'hsl(217, 91%, 60%)', description: 'Auto insurance, rideshare deals' },
  home_services: { label: 'Home Services', icon: <Home className="h-5 w-5" />, color: 'hsl(142, 71%, 45%)', description: 'Furniture rental, cleaning' },
  telephony: { label: 'Telephony/Tech', icon: <Phone className="h-5 w-5" />, color: 'hsl(262, 83%, 58%)', description: 'Phone plan partnerships' },
  employment: { label: 'Employment', icon: <Briefcase className="h-5 w-5" />, color: 'hsl(47, 96%, 53%)', description: 'Staffing, job placement' },
  financial: { label: 'Financial Services', icon: <DollarSign className="h-5 w-5" />, color: 'hsl(173, 80%, 40%)', description: 'Fintech, banking partnerships' },
  moving: { label: 'Moving/Logistics', icon: <Truck className="h-5 w-5" />, color: 'hsl(330, 81%, 60%)', description: 'Moving services' },
};

const CATEGORY_COLORS = [
  'hsl(var(--primary))',
  'hsl(25, 95%, 53%)',
  'hsl(217, 91%, 60%)',
  'hsl(142, 71%, 45%)',
  'hsl(262, 83%, 58%)',
  'hsl(47, 96%, 53%)',
  'hsl(173, 80%, 40%)',
  'hsl(330, 81%, 60%)',
];

type DateRangeOption = 'thisWeek' | 'lastMonth' | 'thisMonth' | 'last3months' | 'allTime';

interface CrossSellOpportunitiesTabProps {
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
}

function getDateRange(range: DateRangeOption): { startDate: string | null; endDate: string | null } {
  const now = new Date();
  switch (range) {
    case 'thisWeek': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return { startDate: start.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: start.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
    }
    case 'last3months': {
      const start = new Date(now);
      start.setMonth(now.getMonth() - 3);
      return { startDate: start.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
    }
    default:
      return { startDate: null, endDate: null };
  }
}

interface BackfillJob {
  id: string;
  status: string;
  total_processed: number;
  total_failed: number;
  remaining: number;
  started_at: string;
}

export function CrossSellOpportunitiesTab({ dateRange, onDateRangeChange }: CrossSellOpportunitiesTabProps) {
  const [data, setData] = useState<AggregatedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  
  // Backfill job polling state
  const [activeJob, setActiveJob] = useState<BackfillJob | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollJob = useCallback(async (jobId: string) => {
    try {
      const { data: job, error } = await supabase
        .from('lifestyle_backfill_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        console.error('Poll error:', error);
        return;
      }

      setActiveJob(job as BackfillJob);

      if (job.status === 'completed') {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        toast.success(`Backfill complete! ${job.total_processed?.toLocaleString()} records processed.`);
        fetchData();
      } else if (job.status === 'cancelled') {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        toast.info(`Backfill cancelled. ${job.total_processed?.toLocaleString()} records processed.`);
      } else if (job.status === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        toast.error('Backfill failed.');
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, []);

  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    // Poll immediately, then every 3s
    pollJob(jobId);
    pollRef.current = setInterval(() => pollJob(jobId), 3000);
  }, [pollJob]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Resume polling if there's a running job on mount
  useEffect(() => {
    const checkRunningJob = async () => {
      try {
        const { data: jobs } = await supabase
          .from('lifestyle_backfill_jobs')
          .select('*')
          .eq('status', 'running')
          .order('created_at', { ascending: false })
          .limit(1);

        if (jobs && jobs.length > 0) {
          const job = jobs[0] as BackfillJob;
          setActiveJob(job);
          startPolling(job.id);
        }
      } catch (err) {
        console.error('Error checking running jobs:', err);
      }
    };
    checkRunningJob();
  }, [startPolling]);

  const elapsed = activeJob?.started_at
    ? Math.floor((Date.now() - new Date(activeJob.started_at).getTime()) / 1000)
    : 0;

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // Timer tick for elapsed display
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeJob || activeJob.status !== 'running') return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeJob]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(dateRange);
      const { data: result, error } = await supabase.functions.invoke('aggregate-lifestyle-signals', {
        body: { startDate, endDate }
      });

      if (error) throw error;
      if (result?.success) {
        setData(result);
      } else {
        throw new Error(result?.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Error fetching cross-sell data:', err);
      toast.error('Failed to load cross-sell data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const runBackfill = async () => {
    setStarting(true);
    try {
      const { startDate, endDate } = getDateRange(dateRange);
      const { data: result, error } = await supabase.functions.invoke('batch-extract-lifestyle-signals', {
        body: { batchSize: 50, startDate, endDate }
      });

      if (error) throw error;

      if (result?.jobId) {
        setActiveJob({
          id: result.jobId,
          status: 'running',
          total_processed: 0,
          total_failed: 0,
          remaining: result.remaining || 0,
          started_at: new Date().toISOString(),
        });
        startPolling(result.jobId);
        toast.success('Backfill started in the background');
      } else if (result?.remaining === 0) {
        toast.info('No records to backfill');
      }
    } catch (err) {
      console.error('Error starting backfill:', err);
      toast.error('Failed to start backfill');
    } finally {
      setStarting(false);
    }
  };

  const cancelBackfill = async () => {
    if (!activeJob) return;
    try {
      await supabase
        .from('lifestyle_backfill_jobs')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('id', activeJob.id);
      
      setActiveJob(prev => prev ? { ...prev, status: 'cancelled' } : null);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      toast.info('Backfill cancellation requested');
    } catch (err) {
      console.error('Error cancelling:', err);
    }
  };

  const isRunning = activeJob?.status === 'running';
  const totalForProgress = activeJob ? (activeJob.total_processed + activeJob.remaining) : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const activeCats = data?.categories?.filter(c => c.count > 0) || [];
  const chartData = activeCats.map(c => ({
    name: CATEGORY_CONFIG[c.category]?.label || c.category,
    count: c.count,
    category: c.category,
  }));

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <ShoppingBag className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Cross-Sell Opportunities</h2>
            <p className="text-sm text-muted-foreground">
              Lifestyle signals extracted from {data?.totalTranscriptions || 0} transcriptions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => onDateRangeChange(v as DateRangeOption)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thisWeek">This Week</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="last3months">Last 3 Months</SelectItem>
              <SelectItem value="allTime">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            onClick={runBackfill}
            disabled={isRunning || starting}
          >
            <Loader2 className={`h-4 w-4 mr-1 ${(isRunning || starting) ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running...' : starting ? 'Starting...' : 'Backfill'}
          </Button>
        </div>
      </div>

      {/* Backfill Progress Bar */}
      {isRunning && activeJob && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Backfilling in background — safe to navigate away</span>
              </div>
              <Button variant="ghost" size="sm" onClick={cancelBackfill}>
                <XCircle className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
            <Progress 
              value={totalForProgress > 0 ? (activeJob.total_processed / totalForProgress) * 100 : 0} 
              className="h-3"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {activeJob.total_processed.toLocaleString()} of {totalForProgress.toLocaleString()} processed
                {totalForProgress > 0 && ` (${Math.round((activeJob.total_processed / totalForProgress) * 100)}%)`}
                {activeJob.total_failed > 0 && ` · ${activeJob.total_failed} failed`}
              </span>
              <span>{formatElapsed(elapsed)} elapsed</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data?.totalSignals || 0}</div>
            <p className="text-sm text-muted-foreground">Total Signals Detected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data?.totalTranscriptionsWithSignals || 0}</div>
            <p className="text-sm text-muted-foreground">Calls with Signals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {data?.totalTranscriptions ? Math.round((data.totalTranscriptionsWithSignals / data.totalTranscriptions) * 100) : 0}%
            </div>
            <p className="text-sm text-muted-foreground">Signal Detection Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* No Data State */}
      {(!data?.totalSignals || data.totalSignals === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Lifestyle Signals Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Signals will be automatically extracted from new call transcriptions. 
              Click "Backfill" to extract signals from existing transcriptions.
            </p>
            <Button onClick={runBackfill} disabled={isRunning || starting}>
              <Zap className="h-4 w-4 mr-2" />
              {isRunning ? 'Processing...' : 'Run Backfill on Existing Calls'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Opportunity Distribution Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Opportunity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => [`${value} signals`, 'Count']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Category Cards with Expandable Details */}
      {activeCats.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Signal Categories
          </h3>
          {activeCats.map((cat) => {
            const config = CATEGORY_CONFIG[cat.category];
            if (!config) return null;
            
            return (
              <Collapsible
                key={cat.category}
                open={expandedCategory === cat.category}
                onOpenChange={(open) => setExpandedCategory(open ? cat.category : null)}
              >
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg" style={{ backgroundColor: `${config.color}20` }}>
                            {config.icon}
                          </div>
                          <div className="text-left">
                            <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
                            <CardDescription className="text-xs">{config.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-base font-bold px-3">
                            {cat.count}
                          </Badge>
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedCategory === cat.category ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      {/* Top quote preview */}
                      {cat.topSignals[0] && (
                        <div className="flex items-start gap-2 mt-2 text-left">
                          <Quote className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground italic line-clamp-1">
                            "{cat.topSignals[0].signal}"
                          </p>
                        </div>
                      )}
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      {/* Top Markets */}
                      {cat.topMarkets.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Top Markets
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {cat.topMarkets.slice(0, 5).map(m => (
                              <Badge key={m.market} variant="outline" className="text-xs">
                                {m.market} ({m.count})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Signal Table */}
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Signal</TableHead>
                              <TableHead className="text-xs">Confidence</TableHead>
                              <TableHead className="text-xs">Opportunity</TableHead>
                              <TableHead className="text-xs">Market</TableHead>
                              <TableHead className="text-xs">Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cat.topSignals.slice(0, 10).map((sig, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs max-w-[200px] truncate">
                                  <span className="italic">"{sig.signal}"</span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={sig.confidence === 'high' ? 'default' : sig.confidence === 'medium' ? 'secondary' : 'outline'} className="text-xs">
                                    {sig.confidence}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs max-w-[180px] truncate">{sig.opportunity}</TableCell>
                                <TableCell className="text-xs">
                                  {sig.marketCity && sig.marketState ? `${sig.marketCity}, ${sig.marketState}` : '—'}
                                </TableCell>
                                <TableCell className="text-xs">{sig.date || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
