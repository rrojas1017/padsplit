import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smile, Sparkles } from 'lucide-react';

export function NonBookingSentimentChart() {
  // This will show real sentiment data when AI analysis is implemented
  // For now, show placeholder
  
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smile className="h-5 w-5 text-amber-500" />
          Non-Booker Sentiment
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
