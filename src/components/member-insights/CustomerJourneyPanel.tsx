import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Map, 
  Clock, 
  DollarSign, 
  Shield, 
  Bus, 
  Search, 
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Quote,
  Target,
  MapPin,
  ArrowRight,
  Lightbulb
} from 'lucide-react';

interface JourneyStage {
  stage: string;
  emotion: string;
  action?: string;
  friction?: string;
  outcome?: string;
}

interface CustomerJourney {
  persona_name: string;
  frequency_percent: number;
  trigger_quote: string;
  journey_stages: JourneyStage[];
  intervention_points: string[];
  example_quotes: string[];
  related_pain_points: string[];
  market_concentration?: Record<string, number>;
}

interface CustomerJourneyPanelProps {
  journeys: CustomerJourney[];
  totalCallsAnalyzed: number;
}

const personaIcons: Record<string, React.ReactNode> = {
  'urgent': <Clock className="h-5 w-5" />,
  'relocator': <Clock className="h-5 w-5" />,
  'budget': <DollarSign className="h-5 w-5" />,
  'calculator': <DollarSign className="h-5 w-5" />,
  'denied': <RefreshCw className="h-5 w-5" />,
  'skeptical': <Shield className="h-5 w-5" />,
  'transit': <Bus className="h-5 w-5" />,
  'transport': <Bus className="h-5 w-5" />,
  'comparison': <Search className="h-5 w-5" />,
  'shopper': <Search className="h-5 w-5" />,
};

const emotionColors: Record<string, string> = {
  'stressed': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'anxious': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'frustrated': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'hesitant': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'confused': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'hopeful': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'interested': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'neutral': 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  'skeptical': 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  'determined': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

function getPersonaIcon(personaName: string): React.ReactNode {
  const lowerName = personaName.toLowerCase();
  for (const [key, icon] of Object.entries(personaIcons)) {
    if (lowerName.includes(key)) return icon;
  }
  return <Map className="h-5 w-5" />;
}

function getEmotionColor(emotion: string): string {
  const lowerEmotion = emotion.toLowerCase();
  for (const [key, color] of Object.entries(emotionColors)) {
    if (lowerEmotion.includes(key)) return color;
  }
  return 'bg-muted text-muted-foreground';
}

function JourneyCard({ journey }: { journey: CustomerJourney }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="border-l-4 border-l-primary">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {getPersonaIcon(journey.persona_name)}
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {journey.persona_name.toUpperCase()}
                    <Badge variant="secondary" className="ml-2">
                      {journey.frequency_percent}% of members
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1 italic text-base">
                    📍 "{journey.trigger_quote}"
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Journey Timeline */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Map className="h-4 w-4" />
                Journey Stages
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                {journey.journey_stages.map((stage, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex flex-col items-center">
                      <div className={`px-3 py-2 rounded-lg border text-center min-w-[100px] ${getEmotionColor(stage.emotion)}`}>
                        <div className="font-medium text-sm">{stage.stage}</div>
                        {stage.friction && (
                          <div className="text-xs mt-1 opacity-80">⚠️ {stage.friction}</div>
                        )}
                        {stage.action && (
                          <div className="text-xs mt-1 opacity-80">{stage.action}</div>
                        )}
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {stage.emotion}
                      </Badge>
                    </div>
                    {index < journey.journey_stages.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Intervention Points */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
                <Target className="h-4 w-4" />
                Intervention Points
              </h4>
              <ul className="space-y-2">
                {journey.intervention_points.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Example Quotes */}
            {journey.example_quotes && journey.example_quotes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Quote className="h-4 w-4" />
                  Actual Member Quotes
                </h4>
                <div className="space-y-2">
                  {journey.example_quotes.slice(0, 3).map((quote, index) => (
                    <blockquote key={index} className="border-l-2 border-muted pl-3 text-sm text-muted-foreground italic">
                      "{quote}"
                    </blockquote>
                  ))}
                </div>
              </div>
            )}

            {/* Related Pain Points */}
            {journey.related_pain_points && journey.related_pain_points.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Related Pain Points</h4>
                <div className="flex flex-wrap gap-2">
                  {journey.related_pain_points.map((point, index) => (
                    <Badge key={index} variant="outline">
                      {point}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Market Concentration */}
            {journey.market_concentration && Object.keys(journey.market_concentration).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Market Concentration
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(journey.market_concentration)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([market, percent]) => (
                      <Badge key={market} variant="secondary">
                        {market}: {percent}%
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function CustomerJourneyPanel({ journeys, totalCallsAnalyzed }: CustomerJourneyPanelProps) {
  if (!journeys || journeys.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Map className="h-5 w-5 text-primary" />
          <CardTitle>Real-Life Customer Journeys</CardTitle>
        </div>
        <CardDescription>
          Based on patterns from {totalCallsAnalyzed.toLocaleString()} analyzed communications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {journeys.map((journey, index) => (
          <JourneyCard key={index} journey={journey} />
        ))}
      </CardContent>
    </Card>
  );
}
