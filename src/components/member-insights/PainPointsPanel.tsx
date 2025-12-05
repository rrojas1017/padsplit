import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CreditCard, Car, Clock, Home } from 'lucide-react';

interface PainPoint {
  category: string;
  description: string;
  frequency: number;
  examples?: string[];
}

interface PaymentInsight {
  insight: string;
  frequency: number;
  impact: string;
}

interface TransportationInsight {
  insight: string;
  frequency: number;
  markets_affected?: string[];
}

interface MoveInBarrier {
  barrier: string;
  frequency: number;
  impact_score: number;
  resolution?: string;
}

interface PainPointsPanelProps {
  painPoints: PainPoint[];
  paymentInsights: PaymentInsight[];
  transportationInsights: TransportationInsight[];
  moveInBarriers: MoveInBarrier[];
}

const getCategoryIcon = (category: string) => {
  const lower = category.toLowerCase();
  if (lower.includes('payment') || lower.includes('price') || lower.includes('cost')) {
    return <CreditCard className="h-4 w-4" />;
  }
  if (lower.includes('transport') || lower.includes('location') || lower.includes('distance')) {
    return <Car className="h-4 w-4" />;
  }
  if (lower.includes('time') || lower.includes('timing') || lower.includes('move-in')) {
    return <Clock className="h-4 w-4" />;
  }
  if (lower.includes('property') || lower.includes('room') || lower.includes('amenity')) {
    return <Home className="h-4 w-4" />;
  }
  return <AlertTriangle className="h-4 w-4" />;
};

const getFrequencyColor = (frequency: number) => {
  if (frequency >= 30) return 'text-destructive';
  if (frequency >= 20) return 'text-amber-500';
  return 'text-muted-foreground';
};

const PainPointsPanel = ({ painPoints, paymentInsights, transportationInsights, moveInBarriers }: PainPointsPanelProps) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Pain Points & Barriers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Accordion type="multiple" defaultValue={['pain-points']} className="space-y-2">
          {/* General Pain Points */}
          {painPoints.length > 0 && (
            <AccordionItem value="pain-points" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span>General Pain Points</span>
                  <Badge variant="secondary" className="ml-2">{painPoints.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {painPoints.map((point, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(point.category)}
                          <span className="font-medium">{point.category}</span>
                        </div>
                        <span className={`text-sm font-semibold ${getFrequencyColor(point.frequency)}`}>
                          {point.frequency}%
                        </span>
                      </div>
                      <Progress value={point.frequency} className="h-2" />
                      <p className="text-sm text-muted-foreground">{point.description}</p>
                      {point.examples && point.examples.length > 0 && (
                        <div className="text-xs text-muted-foreground italic pl-4 border-l-2">
                          "{point.examples[0]}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Payment Insights */}
          {paymentInsights.length > 0 && (
            <AccordionItem value="payment" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-green-500" />
                  <span>Payment Insights</span>
                  <Badge variant="secondary" className="ml-2">{paymentInsights.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {paymentInsights.map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                      <div className="flex-1">
                        <p className="text-sm">{insight.insight}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={insight.impact === 'high' ? 'destructive' : insight.impact === 'medium' ? 'default' : 'secondary'}>
                            {insight.impact} impact
                          </Badge>
                          <span className="text-xs text-muted-foreground">{insight.frequency}% of calls</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Transportation Insights */}
          {transportationInsights.length > 0 && (
            <AccordionItem value="transportation" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-blue-500" />
                  <span>Transportation</span>
                  <Badge variant="secondary" className="ml-2">{transportationInsights.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {transportationInsights.map((insight, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-muted/50">
                      <p className="text-sm">{insight.insight}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{insight.frequency}% of calls</span>
                        {insight.markets_affected?.map((market, mIdx) => (
                          <Badge key={mIdx} variant="outline" className="text-xs">{market}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Move-In Barriers */}
          {moveInBarriers.length > 0 && (
            <AccordionItem value="barriers" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span>Move-In Barriers</span>
                  <Badge variant="secondary" className="ml-2">{moveInBarriers.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {moveInBarriers.map((barrier, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{barrier.barrier}</span>
                        <Badge variant={barrier.impact_score >= 7 ? 'destructive' : barrier.impact_score >= 4 ? 'default' : 'secondary'}>
                          Impact: {barrier.impact_score}/10
                        </Badge>
                      </div>
                      <Progress value={barrier.frequency} className="h-2" />
                      {barrier.resolution && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Resolution:</span> {barrier.resolution}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {painPoints.length === 0 && paymentInsights.length === 0 && 
         transportationInsights.length === 0 && moveInBarriers.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No pain points identified in this analysis
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default PainPointsPanel;