import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, ChevronDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';

interface MarketData {
  top_concern: string;
  unique_pattern: string;
  call_count: number;
  pain_point_frequencies?: Record<string, number>;
}

interface MarketInsightsProps {
  marketData: Record<string, MarketData>;
}

const PainPointBreakdown = ({ frequencies }: { frequencies?: Record<string, number> }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!frequencies || Object.keys(frequencies).length === 0) return null;
  
  const sortedPainPoints = Object.entries(frequencies).sort(([, a], [, b]) => b - a);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          {sortedPainPoints.length} pain points
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1.5">
        {sortedPainPoints.map(([painPoint, freq]) => (
          <div key={painPoint} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate text-muted-foreground">{painPoint}</span>
              <span className="font-medium ml-2">{freq}%</span>
            </div>
            <Progress value={freq} className="h-1" />
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

const MarketInsights = ({ marketData }: MarketInsightsProps) => {
  const markets = Object.entries(marketData || {})
    .filter(([_, data]) => data.call_count >= 1)
    .sort(([, a], [, b]) => b.call_count - a.call_count);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-500" />
          Market Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {markets.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead className="text-center">Calls</TableHead>
                  <TableHead>Top Concern</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {markets.map(([market, data], idx) => (
                  <TableRow key={market}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{market}</span>
                        {idx === 0 && (
                          <Badge variant="default" className="text-xs">Top</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{data.call_count}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`
                          ${data.top_concern?.toLowerCase().includes('transport') ? 'border-blue-500 text-blue-500' : ''}
                          ${data.top_concern?.toLowerCase().includes('price') || data.top_concern?.toLowerCase().includes('payment') ? 'border-green-500 text-green-500' : ''}
                          ${data.top_concern?.toLowerCase().includes('time') || data.top_concern?.toLowerCase().includes('timing') ? 'border-amber-500 text-amber-500' : ''}
                        `}
                      >
                        {data.top_concern || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {data.pain_point_frequencies ? (
                        <PainPointBreakdown frequencies={data.pain_point_frequencies} />
                      ) : (
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]" title={data.unique_pattern}>
                          {data.unique_pattern || 'No unique patterns'}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <MapPin className="h-10 w-10 mb-2 opacity-50" />
            <p>No market-specific insights available</p>
            <p className="text-xs mt-1">Markets need 3+ calls for analysis</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MarketInsights;
