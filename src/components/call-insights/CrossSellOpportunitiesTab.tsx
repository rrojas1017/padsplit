import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Heart, PawPrint, Car, Home, Phone, Briefcase, DollarSign, Truck, 
  ChevronDown, TrendingUp, BarChart3, RefreshCw, Zap, ShoppingBag,
  MapPin, Quote, AlertCircle
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

export function CrossSellOpportunitiesTab({ dateRange, onDateRangeChange }: CrossSellOpportunitiesTabProps) {
  const [data, setData] = useState<AggregatedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

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
    setBackfillRunning(true);
    const { startDate, endDate } = getDateRange(dateRange);
    toast.info('Running backfill... this may take up to 45 seconds.');
    try {
      const { data: result, error } = await supabase.functions.invoke('batch-extract-lifestyle-signals', {
        body: { batchSize: 50, startDate, endDate }
      });

      if (error) throw error;
      
      if (result?.processed > 0) {
        toast.success(`Processed ${result.processed} transcriptions. ~${result.remaining} remaining.`);
      } else {
        toast.info('No transcriptions need processing for this date range.');
      }
      // Refresh data after backfill
      fetchData();
    } catch (err) {
      console.error('Backfill error:', err);
      toast.error('Backfill failed');
    } finally {
      setBackfillRunning(false);
    }
  };

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
            variant="outline" 
            size="sm" 
            onClick={runBackfill}
            disabled={backfillRunning}
          >
            <Zap className="h-4 w-4 mr-1" />
            {backfillRunning ? 'Running...' : 'Backfill'}
          </Button>
        </div>
      </div>

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
            <Button onClick={runBackfill} disabled={backfillRunning}>
              <Zap className="h-4 w-4 mr-2" />
              {backfillRunning ? 'Processing...' : 'Run Backfill on Existing Calls'}
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
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Top Markets
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {cat.topMarkets.slice(0, 6).map(m => (
                              <Badge key={m.market} variant="outline" className="text-xs">
                                {m.market} ({m.count})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Signal Details Table */}
                      {cat.topSignals.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                            Recent Signals
                          </h4>
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Signal</TableHead>
                                  <TableHead className="text-xs">Opportunity</TableHead>
                                  <TableHead className="text-xs">Confidence</TableHead>
                                  <TableHead className="text-xs">Market</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {cat.topSignals.slice(0, 5).map((s, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="text-xs max-w-[200px]">
                                      <span className="italic">"{s.signal}"</span>
                                    </TableCell>
                                    <TableCell className="text-xs">{s.opportunity}</TableCell>
                                    <TableCell>
                                      <Badge 
                                        variant={s.confidence === 'high' ? 'default' : 'secondary'}
                                        className="text-xs"
                                      >
                                        {s.confidence}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">{s.marketCity}, {s.marketState}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
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
