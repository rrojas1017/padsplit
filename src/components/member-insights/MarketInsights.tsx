import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface MarketData {
  top_concern: string;
  unique_pattern: string;
  call_count: number;
}

interface MarketInsightsProps {
  marketData: Record<string, MarketData>;
}

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
                  <TableHead>Unique Pattern</TableHead>
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
                    <TableCell className="max-w-[200px]">
                      <p className="text-sm text-muted-foreground truncate" title={data.unique_pattern}>
                        {data.unique_pattern || 'No unique patterns identified'}
                      </p>
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