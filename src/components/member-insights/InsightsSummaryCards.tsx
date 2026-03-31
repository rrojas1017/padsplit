import { Card, CardContent } from '@/components/ui/card';
import { Phone, TrendingDown, TrendingUp, AlertTriangle, Smile, Clock, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

interface InsightsSummaryCardsProps {
  insight: {
    total_calls_analyzed: number;
    date_range_start: string;
    date_range_end: string;
    pain_points: any[];
    sentiment_distribution: { positive: number; neutral: number; negative: number };
    objection_patterns: any[];
    avg_call_duration_seconds?: number;
    trend_comparison?: {
      previous_total_calls?: number;
      previous_date_range?: string;
    } | null;
    emerging_issues?: string[];
  };
}

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const TrendIndicator = ({ current, previous }: { current: number; previous?: number }) => {
  if (previous === undefined || previous === null) return null;
  
  const delta = current - previous;
  const percentChange = previous > 0 ? Math.round((delta / previous) * 100) : 0;
  
  if (delta === 0) return null;
  
  return (
    <span className={`text-xs flex items-center gap-0.5 ${delta > 0 ? 'text-green-500' : 'text-amber-500'}`}>
      {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {delta > 0 ? '+' : ''}{percentChange}%
    </span>
  );
};

const InsightsSummaryCards = ({ insight }: InsightsSummaryCardsProps) => {
  const topPainPoint = insight.pain_points?.[0];
  const topObjection = insight.objection_patterns?.[0];
  const dominantSentiment = Object.entries(insight.sentiment_distribution)
    .sort(([, a], [, b]) => b - a)[0];
  
  const emergingCount = insight.emerging_issues?.length || 0;
  const hasTrendData = insight.trend_comparison?.previous_total_calls !== undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Total Calls */}
      <Card className="relative overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 to-primary" />
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Booking Calls Analyzed</p>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold">{insight.total_calls_analyzed}</p>
                {hasTrendData && (
                  <TrendIndicator 
                    current={insight.total_calls_analyzed} 
                    previous={insight.trend_comparison?.previous_total_calls} 
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(insight.date_range_start), 'MMM d')} - {format(new Date(insight.date_range_end), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="p-3 rounded-full bg-primary/10">
              <Phone className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Pain Point */}
      <Card className="relative overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive/60 to-destructive" />
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">Top Pain Point</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold truncate">
                  {topPainPoint?.category || 'None identified'}
                </p>
                {topPainPoint?.is_emerging && (
                  <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                    NEW
                  </span>
                )}
              </div>
              {topPainPoint?.frequency && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {topPainPoint.frequency}% of calls
                  </span>
                  {topPainPoint.trend_delta !== undefined && topPainPoint.trend_delta !== 0 && (
                    <span className={`text-xs flex items-center gap-0.5 ${topPainPoint.trend_delta > 0 ? 'text-destructive' : 'text-green-500'}`}>
                      {topPainPoint.trend_delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {topPainPoint.trend_delta > 0 ? '+' : ''}{topPainPoint.trend_delta.toFixed(1)}%
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="p-3 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dominant Sentiment */}
      <Card className="relative overflow-hidden">
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${
          dominantSentiment?.[0] === 'positive' ? 'from-green-500/60 to-green-500' :
          dominantSentiment?.[0] === 'negative' ? 'from-destructive/60 to-destructive' : 'from-amber-500/60 to-amber-500'
        }`} />
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Overall Sentiment</p>
              <p className="text-lg font-bold capitalize">{dominantSentiment?.[0] || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {dominantSentiment?.[1] || 0}% of calls
              </p>
            </div>
            <div className={`p-3 rounded-full ${
              dominantSentiment?.[0] === 'positive' ? 'bg-green-500/10' :
              dominantSentiment?.[0] === 'negative' ? 'bg-destructive/10' : 'bg-amber-500/10'
            }`}>
              <Smile className={`h-6 w-6 ${
                dominantSentiment?.[0] === 'positive' ? 'text-green-500' :
                dominantSentiment?.[0] === 'negative' ? 'text-destructive' : 'text-amber-500'
              }`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emerging Issues OR Top Objection */}
      {emergingCount > 0 ? (
        <Card className="relative overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500/60 to-purple-500" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">Emerging Issues</p>
                <p className="text-lg font-bold">{emergingCount} new</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {insight.emerging_issues?.slice(0, 2).join(', ')}
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/10 flex-shrink-0">
                <Sparkles className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="relative overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/60 to-amber-500" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">Top Objection</p>
                <p className="text-sm font-bold line-clamp-2">
                  {topObjection?.objection || 'None identified'}
                </p>
                {topObjection?.frequency && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {topObjection.frequency}% of calls
                  </p>
                )}
              </div>
              <div className="p-3 rounded-full bg-amber-500/10 flex-shrink-0">
                <TrendingDown className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Avg Duration */}
      <Card className="relative overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 to-primary" />
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Duration</p>
              <p className="text-3xl font-bold">{formatDuration(insight.avg_call_duration_seconds || 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">minutes per call</p>
            </div>
            <div className="p-3 rounded-full bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InsightsSummaryCards;
