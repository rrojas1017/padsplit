import { useState } from 'react';
import { AgentCoachingSummary, getScoreColor, getRatingBadgeStyle, formatRating } from '@/utils/coachingCalculations';
import { ChevronDown, ChevronUp, Lightbulb, ThumbsUp, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AgentFeedbackCardProps {
  summary: AgentCoachingSummary;
  onViewDetails?: (agentId: string) => void;
}

export function AgentFeedbackCard({ summary, onViewDetails }: AgentFeedbackCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const { agent, transcribedCalls, avgScores, latestRating, strengths, improvements, coachingTips } = summary;
  
  const initials = agent.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const scoreLabels = [
    { key: 'communication', label: 'Comm' },
    { key: 'productKnowledge', label: 'Product' },
    { key: 'objectionHandling', label: 'Objection' },
    { key: 'closingSkills', label: 'Closing' },
  ];

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      {/* Main Row */}
      <div 
        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={agent.avatarUrl} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground truncate">{agent.name}</h4>
            <span className="text-xs text-muted-foreground">({transcribedCalls} calls)</span>
          </div>
          <p className="text-xs text-muted-foreground">{agent.siteName}</p>
        </div>

        {/* Mini Score Bars */}
        <div className="hidden md:flex items-center gap-2">
          {scoreLabels.map(({ key, label }) => (
            <div key={key} className="text-center">
              <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full", getScoreColor(avgScores[key as keyof typeof avgScores]))}
                  style={{ width: `${(avgScores[key as keyof typeof avgScores] / 10) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Rating Badge */}
        <Badge className={cn("shrink-0", getRatingBadgeStyle(latestRating))}>
          {formatRating(latestRating)}
        </Badge>

        {/* Expand Icon */}
        <Button variant="ghost" size="icon" className="shrink-0">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border bg-muted/20 animate-slide-up">
          {/* Mobile Scores */}
          <div className="md:hidden mb-4 grid grid-cols-2 gap-2">
            {scoreLabels.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{avgScores[key as keyof typeof avgScores].toFixed(1)}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Strengths */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ThumbsUp className="h-3.5 w-3.5 text-success" />
                <span className="text-xs font-medium text-foreground">Strengths</span>
              </div>
              {strengths.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data</p>
              ) : (
                <ul className="space-y-1">
                  {strengths.slice(0, 3).map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Improvements */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs font-medium text-foreground">Improvements</span>
              </div>
              {improvements.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data</p>
              ) : (
                <ul className="space-y-1">
                  {improvements.slice(0, 3).map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Coaching Tips */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-medium text-foreground">Recent Tips</span>
              </div>
              {coachingTips.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tips yet</p>
              ) : (
                <ul className="space-y-1">
                  {coachingTips.slice(0, 2).map((t, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {t}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {onViewDetails && (
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => onViewDetails(agent.id)}>
                View Full Details
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
