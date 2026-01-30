import React from 'react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { CallKeyPoints } from '@/types';
import { cn } from '@/lib/utils';
import {
  User,
  Target,
  Smile,
  Meh,
  Frown,
  DollarSign,
  Users,
  Calendar,
  ClipboardList,
  AlertTriangle,
  MessageSquare,
  Loader2,
  FileX,
} from 'lucide-react';

interface ContactProfileHoverCardProps {
  memberName: string;
  callKeyPoints?: CallKeyPoints;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'unavailable';
  children: React.ReactNode;
}

const ReadinessBadge = ({ readiness }: { readiness: 'high' | 'medium' | 'low' }) => {
  const config = {
    high: { label: 'HIGH', className: 'bg-success/20 text-success border-success/30' },
    medium: { label: 'MEDIUM', className: 'bg-warning/20 text-warning border-warning/30' },
    low: { label: 'LOW', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  };
  
  return (
    <Badge variant="outline" className={cn('text-xs font-semibold', config[readiness].className)}>
      {config[readiness].label}
    </Badge>
  );
};

const SentimentIcon = ({ sentiment }: { sentiment: 'positive' | 'neutral' | 'negative' }) => {
  const config = {
    positive: { Icon: Smile, className: 'text-success', label: 'Positive' },
    neutral: { Icon: Meh, className: 'text-muted-foreground', label: 'Neutral' },
    negative: { Icon: Frown, className: 'text-destructive', label: 'Negative' },
  };
  
  const { Icon, className, label } = config[sentiment];
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn('h-4 w-4', className)} />
      <span className={cn('text-xs font-medium', className)}>{label}</span>
    </div>
  );
};

export function ContactProfileHoverCard({
  memberName,
  callKeyPoints,
  transcriptionStatus,
  children,
}: ContactProfileHoverCardProps) {
  const hasInsights = callKeyPoints && transcriptionStatus === 'completed';
  const isProcessing = transcriptionStatus === 'pending' || transcriptionStatus === 'processing';

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-80 p-0 overflow-hidden" 
        side="right" 
        align="start"
        sideOffset={8}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">{memberName}</p>
              <p className="text-xs text-muted-foreground">Contact Profile</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
              <p className="text-sm font-medium text-foreground">Insights being generated...</p>
              <p className="text-xs text-muted-foreground mt-1">Check back shortly</p>
            </div>
          ) : !hasInsights ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <FileX className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No call insights available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Manual entry or import without call
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quick Stats Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Move-In Ready:</span>
                  <ReadinessBadge readiness={callKeyPoints.moveInReadiness} />
                </div>
                <SentimentIcon sentiment={callKeyPoints.callSentiment} />
              </div>

              {/* Member Details Grid */}
              {callKeyPoints.memberDetails && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/30 rounded-lg">
                  {callKeyPoints.memberDetails.weeklyBudget && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3.5 w-3.5 text-success" />
                      <span className="text-xs">
                        <span className="text-muted-foreground">Budget:</span>{' '}
                        <span className="font-medium text-foreground">${callKeyPoints.memberDetails.weeklyBudget}/wk</span>
                      </span>
                    </div>
                  )}
                  {callKeyPoints.memberDetails.householdSize && (
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs">
                        <span className="text-muted-foreground">Household:</span>{' '}
                        <span className="font-medium text-foreground">{callKeyPoints.memberDetails.householdSize}</span>
                      </span>
                    </div>
                  )}
                  {callKeyPoints.memberDetails.commitmentWeeks && (
                    <div className="flex items-center gap-2 col-span-2">
                      <Calendar className="h-3.5 w-3.5 text-warning" />
                      <span className="text-xs">
                        <span className="text-muted-foreground">Commitment:</span>{' '}
                        <span className="font-medium text-foreground">
                          {callKeyPoints.memberDetails.commitmentWeeks >= 4 
                            ? `${Math.round(callKeyPoints.memberDetails.commitmentWeeks / 4)} months`
                            : `${callKeyPoints.memberDetails.commitmentWeeks} weeks`
                          }
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Preferences */}
              {callKeyPoints.memberPreferences && callKeyPoints.memberPreferences.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ClipboardList className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">What They Want</span>
                  </div>
                  <ul className="space-y-1">
                    {callKeyPoints.memberPreferences.slice(0, 3).map((pref, index) => (
                      <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span className="line-clamp-1">{pref}</span>
                      </li>
                    ))}
                    {callKeyPoints.memberPreferences.length > 3 && (
                      <li className="text-xs text-muted-foreground italic">
                        +{callKeyPoints.memberPreferences.length - 3} more...
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Concerns */}
              {callKeyPoints.memberConcerns && callKeyPoints.memberConcerns.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Concerns Raised</span>
                  </div>
                  <ul className="space-y-1">
                    {callKeyPoints.memberConcerns.slice(0, 3).map((concern, index) => (
                      <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-warning mt-0.5">•</span>
                        <span className="line-clamp-1">{concern}</span>
                      </li>
                    ))}
                    {callKeyPoints.memberConcerns.length > 3 && (
                      <li className="text-xs text-muted-foreground italic">
                        +{callKeyPoints.memberConcerns.length - 3} more...
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Objections */}
              {callKeyPoints.objections && callKeyPoints.objections.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Objections</span>
                  </div>
                  <ul className="space-y-1">
                    {callKeyPoints.objections.slice(0, 2).map((objection, index) => (
                      <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-destructive mt-0.5">•</span>
                        <span className="line-clamp-1">{objection}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasInsights && (
          <div className="px-4 py-2 bg-muted/30 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              💡 Click the <span className="text-purple-500">transcript icon</span> for full insights
            </p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
