import React, { useState } from 'react';
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
  Mail,
  MessageSquare,
  Loader2,
  FileX,
  Phone,
  Clock,
  DollarSign,
  Home,
  Sparkles,
  AlertTriangle,
  Mic,
} from 'lucide-react';
import { format } from 'date-fns';
import { useContactCommunications } from '@/hooks/useContactCommunications';
import { maskEmail, maskPhone } from '@/utils/contactPrivacy';
import { calculateFollowUpPriority, BookingForPriority } from '@/utils/followUpPriority';
import { FollowUpPriorityBadge } from './FollowUpPriorityBadge';
import { SendEmailDialog } from './SendEmailDialog';
import { SendSMSDialog } from './SendSMSDialog';
import { EmailVerificationBadge, EmailVerificationStatus } from './EmailVerificationBadge';

interface ContactProfileHoverCardProps {
  memberName: string;
  callKeyPoints?: CallKeyPoints;
  callSummary?: string; // Kept for backward compatibility
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'unavailable';
  contactEmail?: string;
  contactPhone?: string;
  bookingId?: string;
  shouldMaskContact?: boolean;
  // Props for priority calculation
  bookingStatus?: string;
  moveInDate?: Date;
  bookingDate?: Date;
  lastContactDate?: Date | null;
  marketCity?: string;
  marketState?: string;
  // Email verification status
  emailVerificationStatus?: EmailVerificationStatus;
  emailVerified?: boolean | null;
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

// Format commitment weeks into readable duration
function formatCommitment(weeks: number): string {
  if (weeks >= 4) {
    const months = Math.round(weeks / 4);
    return `${months} month${months !== 1 ? 's' : ''}`;
  }
  return `${weeks} week${weeks !== 1 ? 's' : ''}`;
}

export function ContactProfileHoverCard({
  memberName,
  callKeyPoints,
  transcriptionStatus,
  contactEmail,
  contactPhone,
  bookingId,
  shouldMaskContact = false,
  bookingStatus,
  moveInDate,
  bookingDate,
  lastContactDate,
  marketCity,
  marketState,
  emailVerificationStatus,
  emailVerified,
  children,
}: ContactProfileHoverCardProps) {
  const hasInsights = callKeyPoints && transcriptionStatus === 'completed';
  const isProcessing = transcriptionStatus === 'pending' || transcriptionStatus === 'processing';
  
  const { lastCommunication, canSendCommunications, logCommunication, refreshCommunications } = useContactCommunications(bookingId);
  
  // State for dialogs
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showSMSDialog, setShowSMSDialog] = useState(false);

  // Calculate follow-up priority if we have status info
  const priority = React.useMemo(() => {
    if (!bookingStatus || !moveInDate || !bookingDate) {
      return { level: null, reason: '' };
    }
    const bookingForPriority: BookingForPriority = {
      status: bookingStatus,
      moveInDate,
      bookingDate,
      callKeyPoints,
      transcriptionStatus,
    };
    // Use lastCommunication date if available, otherwise fall back to passed lastContactDate
    const effectiveLastContact = lastCommunication?.sentAt 
      ? new Date(lastCommunication.sentAt) 
      : lastContactDate;
    return calculateFollowUpPriority(bookingForPriority, effectiveLastContact);
  }, [bookingStatus, moveInDate, bookingDate, callKeyPoints, transcriptionStatus, lastCommunication, lastContactDate]);

  const handleEmailClick = () => {
    if (contactEmail && bookingId && canSendCommunications) {
      // Open the email dialog instead of mailto
      setShowEmailDialog(true);
    }
  };

  const handleSmsClick = () => {
    if (contactPhone && bookingId && canSendCommunications) {
      // Open the SMS dialog instead of native sms: URL
      setShowSMSDialog(true);
    }
  };

  const handleVoiceNoteClick = () => {
    if (contactPhone && bookingId) {
      const cleanPhone = contactPhone.replace(/\D/g, '');
      window.location.href = `tel:${cleanPhone}`;
      logCommunication({
        bookingId,
        communicationType: 'voice_note',
        recipientPhone: contactPhone,
      });
    }
  };

  const memberDetails = hasInsights ? callKeyPoints.memberDetails : null;
  const memberPreferences = hasInsights ? callKeyPoints.memberPreferences : null;
  const memberConcerns = hasInsights ? callKeyPoints.memberConcerns : null;

  // Check if we have any budget/timeline data
  const hasBudgetTimeline = memberDetails?.weeklyBudget || memberDetails?.moveInDate || memberDetails?.commitmentWeeks;
  
  // Check if we have household data
  const hasHousehold = memberDetails?.householdSize || memberDetails?.preferredPaymentMethod;

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
            <div className="flex items-center gap-1.5">
              {/* Follow-up Priority Badge */}
              <FollowUpPriorityBadge priority={priority} size="sm" />
              {/* Readiness Badge */}
              {hasInsights && (
                <div className="flex items-center gap-1">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  <ReadinessBadge readiness={callKeyPoints.moveInReadiness} />
                </div>
              )}
            </div>
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
              <p className="text-sm font-medium text-muted-foreground">No contact insights</p>
              <p className="text-xs text-muted-foreground mt-1">
                {contactEmail || contactPhone ? 'Add call insights for richer context' : 'Manual entry or import'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Budget & Timeline */}
              {hasBudgetTimeline && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Budget & Timeline
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground">
                    {memberDetails?.weeklyBudget && (
                      <span className="font-medium">${memberDetails.weeklyBudget}/wk</span>
                    )}
                    {memberDetails?.weeklyBudget && (memberDetails?.moveInDate || memberDetails?.commitmentWeeks) && (
                      <span className="text-muted-foreground">·</span>
                    )}
                    {memberDetails?.moveInDate && (
                      <span>Move: {memberDetails.moveInDate}</span>
                    )}
                    {memberDetails?.moveInDate && memberDetails?.commitmentWeeks && (
                      <span className="text-muted-foreground">·</span>
                    )}
                    {memberDetails?.commitmentWeeks && (
                      <span>{formatCommitment(memberDetails.commitmentWeeks)}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Household */}
              {hasHousehold && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Home className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Household
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground">
                    {memberDetails?.householdSize && (
                      <span>
                        {memberDetails.householdSize} {memberDetails.householdSize === 1 ? 'person' : 'people'}
                      </span>
                    )}
                    {memberDetails?.householdSize && memberDetails?.preferredPaymentMethod && (
                      <span className="text-muted-foreground">·</span>
                    )}
                    {memberDetails?.preferredPaymentMethod && (
                      <span>{memberDetails.preferredPaymentMethod} preferred</span>
                    )}
                  </div>
                </div>
              )}

              {/* Looking For (Preferences) */}
              {memberPreferences && memberPreferences.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Looking For
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {memberPreferences.slice(0, 3).map((pref, index) => (
                      <li key={index} className="text-xs text-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span className="line-clamp-2 leading-snug">{pref}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Concerns */}
              {memberConcerns && memberConcerns.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Concerns
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {memberConcerns.slice(0, 2).map((concern, index) => (
                      <li key={index} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                        <span className="mt-0.5">•</span>
                        <span className="leading-snug">{concern}</span>
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
                  <span className="flex items-center gap-1 truncate max-w-[160px]">
                    <Mail className="h-3 w-3" />
                    {shouldMaskContact ? maskEmail(contactEmail) : contactEmail}
                    <EmailVerificationBadge status={emailVerificationStatus} verified={emailVerified} />
                  </span>
                )}
                {contactEmail && contactPhone && <span>·</span>}
                {contactPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {shouldMaskContact ? maskPhone(contactPhone) : contactPhone}
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
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={handleVoiceNoteClick}
                  disabled={!contactPhone || !canSendCommunications}
                  title={!canSendCommunications ? 'Communication permission required' : 'Call'}
                >
                  <Mic className="h-3.5 w-3.5 mr-1.5" />
                  Voice
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

      {/* Email Dialog */}
      {contactEmail && bookingId && (
        <SendEmailDialog
          isOpen={showEmailDialog}
          onClose={() => setShowEmailDialog(false)}
          bookingId={bookingId}
          recipientEmail={contactEmail}
          memberName={memberName}
          marketCity={marketCity}
          marketState={marketState}
          moveInDate={moveInDate}
          status={bookingStatus}
          onEmailSent={refreshCommunications}
        />
      )}

      {/* SMS Dialog */}
      {contactPhone && bookingId && (
        <SendSMSDialog
          isOpen={showSMSDialog}
          onClose={() => setShowSMSDialog(false)}
          bookingId={bookingId}
          recipientPhone={contactPhone}
          memberName={memberName}
          marketCity={marketCity}
          marketState={marketState}
          moveInDate={moveInDate}
          status={bookingStatus}
          onSMSSent={refreshCommunications}
        />
      )}
    </HoverCard>
  );
}
