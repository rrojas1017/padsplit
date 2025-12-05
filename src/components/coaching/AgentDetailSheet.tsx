import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Agent, Booking, AgentFeedback } from '@/types';
import { getScoreColor, getRatingBadgeStyle, formatRating } from '@/utils/coachingCalculations';
import { MessageSquare, ThumbsUp, AlertTriangle, Lightbulb, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AgentDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  bookings: Booking[];
}

export function AgentDetailSheet({ open, onOpenChange, agent, bookings }: AgentDetailSheetProps) {
  if (!agent) return null;

  const agentBookings = bookings.filter(b => b.agentId === agent.id && b.agentFeedback && b.transcriptionStatus === 'completed');
  
  // Calculate averages
  const avgScores = {
    communication: 0,
    productKnowledge: 0,
    objectionHandling: 0,
    closingSkills: 0,
  };

  agentBookings.forEach(b => {
    const fb = b.agentFeedback as AgentFeedback;
    if (fb.scores) {
      avgScores.communication += fb.scores.communication || 0;
      avgScores.productKnowledge += fb.scores.productKnowledge || 0;
      avgScores.objectionHandling += fb.scores.objectionHandling || 0;
      avgScores.closingSkills += fb.scores.closingSkills || 0;
    }
  });

  const count = agentBookings.length;
  if (count > 0) {
    Object.keys(avgScores).forEach(key => {
      avgScores[key as keyof typeof avgScores] = Math.round((avgScores[key as keyof typeof avgScores] / count) * 10) / 10;
    });
  }

  // Aggregate all feedback
  const allStrengths: Record<string, number> = {};
  const allImprovements: Record<string, number> = {};
  const allTips: string[] = [];

  agentBookings.forEach(b => {
    const fb = b.agentFeedback as AgentFeedback;
    fb.strengths?.forEach(s => { allStrengths[s] = (allStrengths[s] || 0) + 1; });
    fb.improvements?.forEach(i => { allImprovements[i] = (allImprovements[i] || 0) + 1; });
    fb.coachingTips?.forEach(t => { if (!allTips.includes(t)) allTips.push(t); });
  });

  const topStrengths = Object.entries(allStrengths).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topImprovements = Object.entries(allImprovements).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const initials = agent.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const scoreLabels = [
    { key: 'communication', label: 'Communication' },
    { key: 'productKnowledge', label: 'Product Knowledge' },
    { key: 'objectionHandling', label: 'Objection Handling' },
    { key: 'closingSkills', label: 'Closing Skills' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={agent.avatarUrl} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-xl">{agent.name}</SheetTitle>
              <p className="text-sm text-muted-foreground">{agent.siteName}</p>
              <p className="text-xs text-muted-foreground">{count} transcribed calls</p>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          {count === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No transcribed calls for this agent yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Average Scores */}
              <div>
                <h4 className="font-medium text-foreground mb-3">Average Scores</h4>
                <div className="grid grid-cols-2 gap-3">
                  {scoreLabels.map(({ key, label }) => (
                    <div key={key} className="bg-muted/30 rounded-lg p-3 border border-border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="font-semibold text-foreground">
                          {avgScores[key as keyof typeof avgScores].toFixed(1)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", getScoreColor(avgScores[key as keyof typeof avgScores]))}
                          style={{ width: `${(avgScores[key as keyof typeof avgScores] / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Strengths */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsUp className="h-4 w-4 text-success" />
                  <h4 className="font-medium text-foreground">Strengths</h4>
                </div>
                {topStrengths.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No strengths identified</p>
                ) : (
                  <ul className="space-y-2">
                    {topStrengths.map(([text, count], i) => (
                      <li key={i} className="flex items-start justify-between gap-2 text-sm">
                        <span className="text-foreground">{text}</span>
                        <Badge variant="secondary" className="text-xs shrink-0">{count}x</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Separator />

              {/* Areas for Improvement */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <h4 className="font-medium text-foreground">Areas for Improvement</h4>
                </div>
                {topImprovements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No improvements identified</p>
                ) : (
                  <ul className="space-y-2">
                    {topImprovements.map(([text, count], i) => (
                      <li key={i} className="flex items-start justify-between gap-2 text-sm">
                        <span className="text-foreground">{text}</span>
                        <Badge variant="secondary" className="text-xs shrink-0">{count}x</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Separator />

              {/* Coaching Tips */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-accent" />
                  <h4 className="font-medium text-foreground">All Coaching Tips</h4>
                </div>
                {allTips.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No coaching tips yet</p>
                ) : (
                  <ul className="space-y-2">
                    {allTips.map((tip, i) => (
                      <li key={i} className="text-sm text-foreground bg-muted/30 p-3 rounded-lg border border-border">
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Separator />

              {/* Call History */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-foreground">Recent Transcribed Calls</h4>
                </div>
                <div className="space-y-2">
                  {agentBookings.slice(0, 10).map((booking) => {
                    const fb = booking.agentFeedback as AgentFeedback;
                    return (
                      <div key={booking.id} className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm text-foreground">{booking.memberName}</span>
                          <Badge className={cn("text-xs", getRatingBadgeStyle(fb.overallRating))}>
                            {formatRating(fb.overallRating)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(booking.bookingDate, 'MMM d, yyyy')} • {booking.marketCity}, {booking.marketState}
                        </p>
                        {fb.coachingTips?.[0] && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Tip: {fb.coachingTips[0]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
