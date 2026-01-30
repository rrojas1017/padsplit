import React from 'react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CallKeyPoints } from '@/types';
import { cn } from '@/lib/utils';
import {
  User,
  Target,
  Smile,
  Meh,
  Frown,
  Mail,
  MessageSquare,
  Loader2,
  FileX,
  Phone,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { useContactCommunications } from '@/hooks/useContactCommunications';

interface ContactProfileHoverCardProps {
  memberName: string;
  callKeyPoints?: CallKeyPoints;
  callSummary?: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'unavailable';
  contactEmail?: string;
  contactPhone?: string;
  bookingId?: string;
  children: React.ReactNode;
}

const ReadinessBadge = ({ readiness }: { readiness: 'high' | 'medium' | 'low' }) => {
  const config = {
    high: { label: 'HIGH', className: 'bg-success/20 text-success border-success/30' },
    medium: { label: 'MEDIUM', className: 'bg-warning/20 text-warning border-warning/30' },
    low: { label: 'LOW', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  };
  
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold px-1.5 py-0', config[readiness].className)}>
      {config[readiness].label}
    </Badge>
  );
};

const SentimentIcon = ({ sentiment }: { sentiment: 'positive' | 'neutral' | 'negative' }) => {
  const config = {
    positive: { Icon: Smile, className: 'text-success' },
    neutral: { Icon: Meh, className: 'text-muted-foreground' },
    negative: { Icon: Frown, className: 'text-destructive' },
  };
  
  const { Icon, className } = config[sentiment];
  return <Icon className={cn('h-4 w-4', className)} />;
};

// Generate key follow-up points from call data
function getFollowUpPoints(callKeyPoints: CallKeyPoints): string[] {
  const points: string[] = [];
  
  // Budget info
  if (callKeyPoints.memberDetails?.weeklyBudget) {
    const fee = callKeyPoints.memberPreferences?.some(p => 
      p.toLowerCase().includes('no moving fee') || p.toLowerCase().includes('waive')
    ) ? ', no moving fee' : '';
    points.push(`$${callKeyPoints.memberDetails.weeklyBudget}/week${fee}`);
  }
  
  // Move-in date
  if (callKeyPoints.memberDetails?.moveInDate) {
    points.push(`Move-in: ${callKeyPoints.memberDetails.moveInDate}`);
  }
  
  // Commitment
  if (callKeyPoints.memberDetails?.commitmentWeeks) {
    const weeks = callKeyPoints.memberDetails.commitmentWeeks;
    const duration = weeks >= 4 ? `${Math.round(weeks / 4)} month${Math.round(weeks / 4) !== 1 ? 's' : ''}` : `${weeks} weeks`;
    points.push(`${duration} commitment`);
  }
  
  // Top preference
  if (callKeyPoints.memberPreferences?.[0] && points.length < 3) {
    points.push(callKeyPoints.memberPreferences[0]);
  }
  
  // Top concern if still room
  if (callKeyPoints.memberConcerns?.[0] && points.length < 3) {
    points.push(`Concern: ${callKeyPoints.memberConcerns[0]}`);
  }
  
  return points.slice(0, 3);
}

export function ContactProfileHoverCard({
  memberName,
  callKeyPoints,
  callSummary,
  transcriptionStatus,
  contactEmail,
  contactPhone,
  bookingId,
  children,
}: ContactProfileHoverCardProps) {
  const hasInsights = callKeyPoints && transcriptionStatus === 'completed';
  const isProcessing = transcriptionStatus === 'pending' || transcriptionStatus === 'processing';
  
  const { lastCommunication, canSendCommunications, logCommunication } = useContactCommunications(bookingId);

  const handleEmailClick = () => {
    if (contactEmail && bookingId) {
      // Open mailto link
      window.location.href = `mailto:${contactEmail}`;
      // Log the communication
      logCommunication({
        bookingId,
        communicationType: 'email',
        recipientEmail: contactEmail,
      });
    }
  };

  const handleSmsClick = () => {
    if (contactPhone && bookingId) {
      // Open SMS link (mobile) or tel link (desktop fallback)
      const cleanPhone = contactPhone.replace(/\D/g, '');
      window.location.href = `sms:${cleanPhone}`;
      // Log the communication
      logCommunication({
        bookingId,
        communicationType: 'sms',
        recipientPhone: contactPhone,
      });
    }
  };

  // Use callSummary prop or fall back to callKeyPoints.summary
  const summaryText = callSummary || callKeyPoints?.summary;
  const followUpPoints = hasInsights ? getFollowUpPoints(callKeyPoints) : [];

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-foreground text-sm truncate max-w-[120px]">
                {memberName}
              </span>
            </div>
            {hasInsights && (
              <div className="flex items-center gap-2">
                <SentimentIcon sentiment={callKeyPoints.callSentiment} />
                <div className="flex items-center gap-1">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  <ReadinessBadge readiness={callKeyPoints.moveInReadiness} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <Loader2 className="h-6 w-6 text-primary animate-spin mb-2" />
              <p className="text-sm font-medium text-foreground">Generating insights...</p>
              <p className="text-xs text-muted-foreground mt-1">Check back shortly</p>
            </div>
          ) : !hasInsights ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <FileX className="h-6 w-6 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No call insights</p>
              <p className="text-xs text-muted-foreground mt-1">
                Manual entry or import
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Quick Summary */}
              {summaryText && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    📝 Quick Summary
                  </p>
                  <p className="text-xs text-foreground leading-relaxed line-clamp-3 italic">
                    "{summaryText}"
                  </p>
                </div>
              )}

              {/* Key Follow-up Points */}
              {followUpPoints.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    💬 Key Follow-up
                  </p>
                  <ul className="space-y-1">
                    {followUpPoints.map((point, index) => (
                      <li key={index} className="text-xs text-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span className="line-clamp-1">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Contact Info & Actions - Always show if we have contact info */}
          {(contactEmail || contactPhone) && (
            <div className="mt-3 pt-3 border-t border-border">
              {/* Contact Details */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 flex-wrap">
                {contactEmail && (
                  <span className="flex items-center gap-1 truncate max-w-[140px]">
                    <Mail className="h-3 w-3" />
                    {contactEmail}
                  </span>
                )}
                {contactEmail && contactPhone && <span>·</span>}
                {contactPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {contactPhone}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={handleEmailClick}
                  disabled={!contactEmail || !canSendCommunications}
                  title={!canSendCommunications ? 'Communication permission required' : 'Send Email'}
                >
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={handleSmsClick}
                  disabled={!contactPhone || !canSendCommunications}
                  title={!canSendCommunications ? 'Communication permission required' : 'Send SMS'}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  SMS
                </Button>
              </div>

              {/* Last Contacted */}
              {lastCommunication && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    Last contacted: {format(lastCommunication.sentAt, 'MMM d')} via {lastCommunication.communicationType.toUpperCase()}
                  </span>
                </div>
              )}

              {/* Permission notice */}
              {!canSendCommunications && (
                <p className="mt-2 text-[10px] text-muted-foreground italic">
                  Contact admin for communication access
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer - Full insights hint */}
        {hasInsights && (
          <div className="px-4 py-2 bg-muted/30 border-t border-border">
            <p className="text-[10px] text-muted-foreground text-center">
              💡 Click <span className="text-purple-500 font-medium">transcript icon</span> for full insights
            </p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
