import { Card, CardContent } from '@/components/ui/card';
import { Phone, TrendingUp, TrendingDown, AlertTriangle, Smile } from 'lucide-react';
import { format } from 'date-fns';

interface InsightsSummaryCardsProps {
  insight: {
    total_calls_analyzed: number;
    date_range_start: string;
    date_range_end: string;
    pain_points: any[];
    sentiment_distribution: { positive: number; neutral: number; negative: number };
    objection_patterns: any[];
  };
}

const InsightsSummaryCards = ({ insight }: InsightsSummaryCardsProps) => {
  const topPainPoint = insight.pain_points?.[0];
  const topObjection = insight.objection_patterns?.[0];
  const dominantSentiment = Object.entries(insight.sentiment_distribution)
    .sort(([, a], [, b]) => b - a)[0];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Calls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Calls Analyzed</p>
              <p className="text-3xl font-bold">{insight.total_calls_analyzed}</p>
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">Top Pain Point</p>
              <p className="text-lg font-bold truncate">
                {topPainPoint?.category || 'None identified'}
              </p>
              {topPainPoint?.frequency && (
                <p className="text-xs text-muted-foreground mt-1">
                  {topPainPoint.frequency}% of calls
                </p>
              )}
            </div>
            <div className="p-3 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dominant Sentiment */}
      <Card>
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

      {/* Top Objection */}
      <Card>
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
    </div>
  );
};

export default InsightsSummaryCards;