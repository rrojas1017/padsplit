import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, CreditCard, Car, Clock, Home, TrendingUp, TrendingDown, Sparkles, Quote, ChevronDown, ExternalLink, Lightbulb, Users, Target } from 'lucide-react';
import { useState } from 'react';

interface PainPointSolution {
  action: string;
  owner: 'Product' | 'Training' | 'Marketing' | 'Operations';
  effort: 'low' | 'medium' | 'high';
  expected_outcome: string;
}

interface PainPointSubCategory {
  name: string;
  frequency: number;
  description: string;
  examples?: string[];
  solution?: PainPointSolution;
}

interface PainPoint {
  category: string;
  description: string;
  frequency: number;
  examples?: string[];
  trend_delta?: number;
  is_emerging?: boolean;
  market_breakdown?: Record<string, number>;
  sub_categories?: PainPointSubCategory[];
  actionable_solutions?: PainPointSolution[];
}

interface PaymentInsight {
  insight: string;
  frequency: number;
  impact: string;
  examples?: string[];
}

interface TransportationInsight {
  insight: string;
  frequency: number;
  markets_affected?: string[];
  examples?: string[];
}

interface MoveInBarrier {
  barrier: string;
  frequency: number;
  impact_score: number;
  resolution?: string;
  examples?: string[];
}

interface PainPointsPanelProps {
  painPoints: PainPoint[];
  paymentInsights: PaymentInsight[];
  transportationInsights: TransportationInsight[];
  moveInBarriers: MoveInBarrier[];
  onViewCalls?: (category: string) => void;
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

const getOwnerColor = (owner: string) => {
  switch (owner) {
    case 'Product': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'Training': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'Marketing': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'Operations': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getEffortColor = (effort: string) => {
  switch (effort) {
    case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-muted text-muted-foreground';
  }
};

const TrendBadge = ({ delta, isEmerging }: { delta?: number; isEmerging?: boolean }) => {
  if (isEmerging) {
    return (
      <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-700">
        <Sparkles className="h-3 w-3 mr-1" />
        NEW
      </Badge>
    );
  }
  
  if (delta === undefined || delta === 0) return null;
  
  const isUp = delta > 0;
  return (
    <Badge 
      variant="outline" 
      className={isUp 
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700' 
        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700'
      }
    >
      {isUp ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
      {isUp ? '+' : ''}{delta.toFixed(1)}%
    </Badge>
  );
};

const QuotesSection = ({ examples }: { examples?: string[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!examples || examples.length === 0) return null;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground hover:text-foreground mt-2 p-1 h-auto">
          <Quote className="h-3 w-3 mr-1" />
          {isOpen ? 'Hide' : 'Show'} {examples.length} quote{examples.length > 1 ? 's' : ''}
          <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {examples.slice(0, 5).map((quote, idx) => (
          <div key={idx} className="text-xs text-muted-foreground italic pl-3 border-l-2 border-muted py-1">
            "{quote}"
          </div>
        ))}
        {examples.length > 5 && (
          <p className="text-xs text-muted-foreground pl-3">
            +{examples.length - 5} more quotes
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

const MarketBreakdownSection = ({ breakdown }: { breakdown?: Record<string, number> }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!breakdown || Object.keys(breakdown).length === 0) return null;
  
  const sortedMarkets = Object.entries(breakdown).sort(([, a], [, b]) => b - a);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground hover:text-foreground mt-1 p-1 h-auto">
          <ExternalLink className="h-3 w-3 mr-1" />
          {isOpen ? 'Hide' : 'View'} market breakdown
          <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="grid grid-cols-2 gap-1">
          {sortedMarkets.slice(0, 6).map(([market, freq]) => (
            <div key={market} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
              <span className="truncate">{market.split(',')[0]}</span>
              <span className="font-medium ml-2">{freq}%</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const SolutionCard = ({ solution }: { solution: PainPointSolution }) => (
  <div className="bg-muted/30 border border-border/50 rounded-lg p-3 space-y-2">
    <div className="flex items-start gap-2">
      <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
      <p className="text-xs font-medium">{solution.action}</p>
    </div>
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getOwnerColor(solution.owner)}`}>
        <Users className="h-2.5 w-2.5 mr-0.5" />
        {solution.owner}
      </Badge>
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getEffortColor(solution.effort)}`}>
        {solution.effort} effort
      </Badge>
    </div>
    <p className="text-[11px] text-muted-foreground">
      <Target className="h-3 w-3 inline mr-1" />
      {solution.expected_outcome}
    </p>
  </div>
);

const SubCategoriesSection = ({ subCategories, parentFrequency }: { subCategories: PainPointSubCategory[]; parentFrequency: number }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!subCategories || subCategories.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-center text-xs mt-2 h-7">
          <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          {isOpen ? 'Hide' : 'View'} Breakdown ({subCategories.length} sub-issues)
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
        {subCategories.map((sub, idx) => (
          <div key={idx} className="border border-border/50 rounded-lg p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{sub.name}</span>
              <span className="text-xs font-semibold text-muted-foreground">{sub.frequency}% of category</span>
            </div>
            <Progress value={sub.frequency} className="h-1.5" />
            <p className="text-xs text-muted-foreground">{sub.description}</p>
            <QuotesSection examples={sub.examples} />
            {sub.solution && <SolutionCard solution={sub.solution} />}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

const ActionableSolutionsSection = ({ solutions }: { solutions?: PainPointSolution[] }) => {
  if (!solutions || solutions.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <Lightbulb className="h-3.5 w-3.5" />
        Recommended Actions
      </div>
      {solutions.map((sol, idx) => (
        <SolutionCard key={idx} solution={sol} />
      ))}
    </div>
  );
};

const PainPointsPanel = ({ painPoints, paymentInsights, transportationInsights, moveInBarriers, onViewCalls }: PainPointsPanelProps) => {
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
                <div className="space-y-4 pt-2">
                  {painPoints.map((point, idx) => (
                    <div key={idx} className="space-y-2 pb-3 border-b last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(point.category)}
                          <span className="font-medium">{point.category}</span>
                          <TrendBadge delta={point.trend_delta} isEmerging={point.is_emerging} />
                        </div>
                        <span className={`text-sm font-semibold ${getFrequencyColor(point.frequency)}`}>
                          {point.frequency}%
                        </span>
                      </div>
                      <Progress value={point.frequency} className="h-2" />
                      <p className="text-sm text-muted-foreground">{point.description}</p>
                      
                      <QuotesSection examples={point.examples} />
                      <MarketBreakdownSection breakdown={point.market_breakdown} />
                      <SubCategoriesSection subCategories={point.sub_categories || []} parentFrequency={point.frequency} />
                      <ActionableSolutionsSection solutions={point.actionable_solutions} />
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
                    <div key={idx} className="p-2 rounded-lg bg-muted/50">
                      <div className="flex-1">
                        <p className="text-sm">{insight.insight}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={insight.impact === 'high' ? 'destructive' : insight.impact === 'medium' ? 'default' : 'secondary'}>
                            {insight.impact} impact
                          </Badge>
                          <span className="text-xs text-muted-foreground">{insight.frequency}% of calls</span>
                        </div>
                        <QuotesSection examples={insight.examples} />
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
                      <QuotesSection examples={insight.examples} />
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
                      <QuotesSection examples={barrier.examples} />
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
