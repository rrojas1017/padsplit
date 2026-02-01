import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smile, Sparkles } from 'lucide-react';

interface SentimentDistribution {
  positive: { count: number; percentage: number };
  neutral: { count: number; percentage: number };
  negative: { count: number; percentage: number };
}

interface NonBookingSentimentChartProps {
  sentiment?: SentimentDistribution | null;
}

export function NonBookingSentimentChart({ sentiment }: NonBookingSentimentChartProps) {
  const hasData = sentiment && (
    sentiment.positive?.count > 0 || 
    sentiment.neutral?.count > 0 || 
    sentiment.negative?.count > 0
  );
  
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smile className="h-5 w-5 text-amber-500" />
          Non-Booker Sentiment
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[280px] flex flex-col justify-center">
            <div className="space-y-6">
              {/* Positive */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-600">Positive</span>
                  <span className="text-sm text-muted-foreground">
                    {sentiment.positive.percentage}% ({sentiment.positive.count} calls)
                  </span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${sentiment.positive.percentage}%` }}
                  />
                </div>
              </div>

              {/* Neutral */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-600">Neutral</span>
                  <span className="text-sm text-muted-foreground">
                    {sentiment.neutral.percentage}% ({sentiment.neutral.count} calls)
                  </span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${sentiment.neutral.percentage}%` }}
                  />
                </div>
              </div>

              {/* Negative */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-destructive">Frustrated/Negative</span>
                  <span className="text-sm text-muted-foreground">
                    {sentiment.negative.percentage}% ({sentiment.negative.count} calls)
                  </span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-destructive rounded-full transition-all duration-500"
                    style={{ width: `${sentiment.negative.percentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Insight text */}
            <p className="text-xs text-muted-foreground mt-6 text-center">
              {sentiment.negative.percentage > 30 
                ? "High frustration rate detected - review objection handling"
                : sentiment.positive.percentage > 40
                ? "Positive sentiment but still no booking - check availability or pricing"
                : "Mixed sentiment - review individual call insights for patterns"
              }
            </p>
          </div>
        ) : (
          <div className="h-[280px] flex flex-col items-center justify-center text-center">
            <div className="p-4 rounded-full bg-amber-500/10 mb-4">
              <Sparkles className="h-8 w-8 text-amber-500" />
            </div>
            <h4 className="font-medium mb-2">Sentiment Analysis Pending</h4>
            <p className="text-sm text-muted-foreground max-w-[280px] mb-4">
              Run AI analysis to understand the emotional tone of non-booking calls
            </p>
            
            {/* Placeholder sentiment bars */}
            <div className="w-full max-w-[280px] space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs w-16 text-left">Frustrated</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-destructive rounded-full" />
                </div>
                <span className="text-xs w-8 text-right text-muted-foreground">--%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs w-16 text-left">Neutral</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-amber-500 rounded-full" />
                </div>
                <span className="text-xs w-8 text-right text-muted-foreground">--%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs w-16 text-left">Positive</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-green-500 rounded-full" />
                </div>
                <span className="text-xs w-8 text-right text-muted-foreground">--%</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
