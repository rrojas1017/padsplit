import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, ChevronDown, ChevronUp, Mic, AlertCircle, CheckCircle2, Clock, TrendingUp, MessageSquare, Target, AlertTriangle, Lightbulb, Smile, Meh, Frown, Star, Award, ThumbsUp, GraduationCap, RefreshCw, Ban, Radio, Wrench, ShieldAlert, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useBookingDetails } from '@/hooks/useBookingDetails';
import { Booking, CallKeyPoints, AgentFeedback, MemberDetails } from '@/types';
import { MemberDetailsCard } from './MemberDetailsCard';
import { getProviderLabel, getProviderBadgeColor } from '@/utils/providerLabels';
import { normalizeDetectedIssues, ISSUE_BADGE_CONFIG } from '@/utils/issueClassifier';

interface TranscriptionModalProps {
  booking: Booking;
  isOpen: boolean;
  onClose: () => void;
  onTranscriptionComplete: () => void;
}

export function TranscriptionModal({ booking, isOpen, onClose, onTranscriptionComplete }: TranscriptionModalProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isMarkingUnavailable, setIsMarkingUnavailable] = useState(false);
  const [isRecoveringCoaching, setIsRecoveringCoaching] = useState(false);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(booking.transcriptionStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // On-demand loading of heavy transcription data
  const { fetchBookingDetails, isLoadingDetails, clearCache, detailsCache } = useBookingDetails();
  const [loadedDetails, setLoadedDetails] = useState<{
    callTranscription?: string;
    callSummary?: string;
    callKeyPoints?: CallKeyPoints;
    agentFeedback?: AgentFeedback;
    coachingAudioUrl?: string;
    sttProvider?: string;
  } | null>(null);

  // Load transcription details when modal opens and status is completed
  useEffect(() => {
    if (isOpen && currentStatus === 'completed') {
      // Check cache first
      if (detailsCache[booking.id]) {
        setLoadedDetails(detailsCache[booking.id] as any);
      } else {
        fetchBookingDetails(booking.id).then(details => {
          if (details) {
            setLoadedDetails(details as any);
          }
        });
      }
    }
  }, [isOpen, currentStatus, booking.id, fetchBookingDetails, detailsCache]);

  // Real-time subscription for status updates
  useEffect(() => {
    if (!isOpen) return;
    
    // Sync with prop
    setCurrentStatus(booking.transcriptionStatus);
    setErrorMessage(booking.transcriptionErrorMessage || null);
    
    // Subscribe to changes for this booking
    const channel = supabase
      .channel(`booking-transcription-${booking.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${booking.id}`,
        },
        (payload) => {
          console.log('Booking update received:', payload);
          const newStatus = payload.new.transcription_status;
          const newErrorMessage = payload.new.transcription_error_message;
          setCurrentStatus(newStatus);
          setErrorMessage(newErrorMessage || null);
          
          if (newStatus === 'completed') {
            toast({
              title: "Transcription Complete",
              description: `Call for ${booking.memberName} has been analyzed.`,
            });
            setIsTranscribing(false);
            // Clear cache and reload details
            clearCache(booking.id);
            fetchBookingDetails(booking.id).then(details => {
              if (details) setLoadedDetails(details as any);
            });
            onTranscriptionComplete();
          } else if (newStatus === 'failed') {
            toast({
              title: "Transcription Failed",
              description: newErrorMessage || "There was an error processing the call.",
              variant: "destructive",
            });
            setIsTranscribing(false);
          } else if (newStatus === 'unavailable') {
            setIsMarkingUnavailable(false);
            onTranscriptionComplete();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, booking.id, booking.memberName, onTranscriptionComplete, toast]);

  // Sync status when booking prop updates
  useEffect(() => {
    setCurrentStatus(booking.transcriptionStatus);
    setErrorMessage(booking.transcriptionErrorMessage || null);
  }, [booking.transcriptionStatus, booking.transcriptionErrorMessage]);

  const handleTranscribe = async () => {
    if (!booking.kixieLink) return;
    
    setIsTranscribing(true);
    setCurrentStatus('processing');
    
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-call', {
        body: { 
          bookingId: booking.id,
          kixieUrl: booking.kixieLink
        }
      });

      if (error) throw error;

      toast({
        title: "Transcription Started",
        description: `Processing call for ${booking.memberName}... You can close this dialog.`,
      });
      
    } catch (error) {
      console.error('Transcription error:', error);
      setCurrentStatus('failed');
      setIsTranscribing(false);
      toast({
        title: "Failed to Start Transcription",
        description: error instanceof Error ? error.message : "Failed to start transcription",
        variant: "destructive",
      });
    }
  };

  const handleReanalyzeCall = async () => {
    setIsReanalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('reanalyze-call', {
        body: { bookingId: booking.id }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Call Re-Analyzed",
          description: "Call insights and coaching have been regenerated with improved AI extraction.",
        });
        onTranscriptionComplete(); // Refresh booking data
      } else {
        throw new Error(data?.error || 'Failed to re-analyze call');
      }
    } catch (error) {
      console.error('Re-analyze call error:', error);
      toast({
        title: "Failed to Re-Analyze",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleMarkUnavailable = async () => {
    setIsMarkingUnavailable(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          transcription_status: 'unavailable',
          transcription_error_message: 'Audio recording marked as unavailable by admin'
        })
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Marked as Unavailable",
        description: "Recording has been marked as unavailable.",
      });
      onTranscriptionComplete();
    } catch (error) {
      console.error('Mark unavailable error:', error);
      toast({
        title: "Failed to Update",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsMarkingUnavailable(false);
    }
  };

  // Recovery handler for missing Jeff coaching (when transcription exists but agent_feedback is null)
  const handleRecoverMissingCoaching = async () => {
    setIsRecoveringCoaching(true);
    try {
      // Step 1: Re-analyze to populate agent_feedback
      toast({
        title: "Step 1/2: Re-Analyzing Call",
        description: "Generating coaching feedback from transcription...",
      });
      
      const { data: reanalyzeData, error: reanalyzeError } = await supabase.functions.invoke('reanalyze-call', {
        body: { bookingId: booking.id }
      });

      if (reanalyzeError) throw reanalyzeError;
      if (!reanalyzeData?.success) throw new Error(reanalyzeData?.error || 'Failed to re-analyze call');

      // Step 2: Generate coaching audio
      toast({
        title: "Step 2/2: Generating Audio",
        description: "Creating Jeff's coaching audio...",
      });
      
      const { data: audioData, error: audioError } = await supabase.functions.invoke('generate-coaching-audio', {
        body: { bookingId: booking.id }
      });

      if (audioError) throw audioError;
      if (!audioData?.success) throw new Error(audioData?.error || 'Failed to generate coaching audio');

      toast({
        title: "Recovery Complete",
        description: "Jeff's coaching feedback and audio have been generated successfully!",
      });
      
      // Clear cache and reload details
      clearCache(booking.id);
      fetchBookingDetails(booking.id).then(details => {
        if (details) setLoadedDetails(details as any);
      });
      onTranscriptionComplete();
      
    } catch (error) {
      console.error('Recovery error:', error);
      toast({
        title: "Recovery Failed",
        description: error instanceof Error ? error.message : "An error occurred during recovery",
        variant: "destructive",
      });
    } finally {
      setIsRecoveringCoaching(false);
    }
  };

  // Derived values from loaded details (on-demand from booking_transcriptions table)
  const keyPoints = loadedDetails?.callKeyPoints as CallKeyPoints | null;
  const agentFeedback = loadedDetails?.agentFeedback as AgentFeedback | null;
  const callSummary = loadedDetails?.callSummary;
  const callTranscription = loadedDetails?.callTranscription;
  const coachingAudioUrl = loadedDetails?.coachingAudioUrl;

  const isProcessing = currentStatus === 'processing' || isTranscribing;
  const hasTranscription = currentStatus === 'completed' && (callSummary || isLoadingDetails);
  const isUnavailable = currentStatus === 'unavailable';
  
  // Only supervisors, admins, and super_admins can re-analyze
  const canManageAnalysis = user && ['super_admin', 'admin', 'supervisor'].includes(user.role);
  
  // Check if analysis appears incomplete (signs of failed/partial AI extraction)
  const hasIncompleteAnalysis = () => {
    if (!hasTranscription || isLoadingDetails) return false;
    
    const summary = callSummary || '';
    
    // Check for parsing failure message
    if (summary.includes('parsing failed')) return true;
    
    // Check if summary is suspiciously short for a completed call
    if (summary.length < 50 && booking.callDurationSeconds && booking.callDurationSeconds > 60) return true;
    
    // Check if all insight arrays are empty for a longer call
    if (booking.callDurationSeconds && booking.callDurationSeconds > 120) {
      const allEmpty = (!keyPoints?.memberConcerns?.length && 
                        !keyPoints?.memberPreferences?.length && 
                        !keyPoints?.recommendedActions?.length && 
                        !keyPoints?.objections?.length);
      if (allEmpty) return true;
    }
    
    return false;
  };
  const showReanalyzeButton = hasTranscription && !isLoadingDetails && hasIncompleteAnalysis() && !isReanalyzing && canManageAnalysis;
  const showMarkUnavailableButton = currentStatus === 'failed' && canManageAnalysis && !isMarkingUnavailable;
  
  // Show recovery button when transcription completed but Jeff's coaching (agent_feedback) is missing
  const showRecoveryButton = hasTranscription && !isLoadingDetails && !agentFeedback && callTranscription && canManageAnalysis && !isRecoveringCoaching;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return <Smile className="h-4 w-4 text-success" />;
      case 'negative': return <Frown className="h-4 w-4 text-destructive" />;
      default: return <Meh className="h-4 w-4 text-warning" />;
    }
  };

  const getReadinessColor = (readiness?: string) => {
    switch (readiness) {
      case 'high': return 'bg-success/20 text-success border-success/30';
      case 'medium': return 'bg-warning/20 text-warning border-warning/30';
      case 'low': return 'bg-destructive/20 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRatingColor = (rating?: string) => {
    switch (rating) {
      case 'excellent': return 'bg-success/20 text-success border-success/30';
      case 'good': return 'bg-primary/20 text-primary border-primary/30';
      case 'needs_improvement': return 'bg-warning/20 text-warning border-warning/30';
      case 'poor': return 'bg-destructive/20 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-success';
    if (score >= 6) return 'bg-primary';
    if (score >= 4) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Call Insights - {booking.memberName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-100px)] pr-4">
          {!hasTranscription ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              {isProcessing ? (
                <>
                  <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                  <p className="text-lg font-medium">Transcribing call...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This may take a minute depending on call length
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    You can close this dialog — you'll be notified when complete
                  </p>
                </>
              ) : currentStatus === 'failed' ? (
                <>
                  <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                  <p className="text-lg font-medium">Transcription Failed</p>
                  {errorMessage ? (
                    <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md text-center">
                      {errorMessage}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1 mb-4">
                      There was an error processing this call recording
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={handleTranscribe} disabled={isTranscribing}>
                      Try Again
                    </Button>
                    {showMarkUnavailableButton && (
                      <Button 
                        variant="outline" 
                        onClick={handleMarkUnavailable}
                        disabled={isMarkingUnavailable}
                      >
                        {isMarkingUnavailable ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Ban className="mr-2 h-4 w-4" />
                        )}
                        Mark Unavailable
                      </Button>
                    )}
                  </div>
                </>
              ) : isUnavailable ? (
                <>
                  <Ban className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Recording Unavailable</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This recording has been marked as unavailable
                  </p>
                </>
              ) : (
                <>
                  <Mic className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No Transcription Yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Click below to transcribe and analyze this call
                  </p>
                  <Button onClick={handleTranscribe} disabled={isTranscribing || !booking.kixieLink}>
                    {isTranscribing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-4 w-4" />
                        Transcribe Call
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Badges */}
              <div className="flex flex-wrap gap-2">
                {/* STT Provider badge - only visible to super_admin */}
                {loadedDetails?.sttProvider && user?.role === 'super_admin' && (
                  <Badge variant="outline" className={getProviderBadgeColor(loadedDetails.sttProvider)}>
                    {getProviderLabel(loadedDetails.sttProvider, true)}
                  </Badge>
                )}
                {keyPoints?.moveInReadiness && (
                  <Badge variant="outline" className={getReadinessColor(keyPoints.moveInReadiness)}>
                    <Target className="h-3 w-3 mr-1" />
                    Move-In Readiness: {keyPoints.moveInReadiness.toUpperCase()}
                  </Badge>
                )}
                {keyPoints?.callSentiment && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    {getSentimentIcon(keyPoints.callSentiment)}
                    Sentiment: {keyPoints.callSentiment}
                  </Badge>
                )}
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Transcribed
                </Badge>
                {booking.callDurationSeconds && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(booking.callDurationSeconds)}
                  </Badge>
                )}
                {/* Pricing Discussion Badge */}
                {keyPoints?.pricingDiscussed && (
                  keyPoints.pricingDiscussed.mentioned ? (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                      <DollarSign className="h-3 w-3 mr-1" />
                      Pricing Discussed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                      <DollarSign className="h-3 w-3 mr-1" />
                      Pricing Not Mentioned
                    </Badge>
                  )
                )}
              </div>

              {/* Summary */}
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Summary
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {callSummary || keyPoints?.summary}
                </p>
              </div>

              {/* Member Details Card - extracted contact/booking info */}
              {keyPoints?.memberDetails && (
                <MemberDetailsCard 
                  memberDetails={keyPoints.memberDetails} 
                  memberName={booking.memberName}
                />
              )}

              {/* Pricing Discussion Details */}
              {keyPoints?.pricingDiscussed && (
                <div className={`rounded-lg p-4 border ${keyPoints.pricingDiscussed.mentioned ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'}`}>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <DollarSign className={`h-4 w-4 ${keyPoints.pricingDiscussed.mentioned ? 'text-success' : 'text-warning'}`} />
                    Pricing Discussion
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {keyPoints.pricingDiscussed.details}
                  </p>
                  {keyPoints.pricingDiscussed.mentioned && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {keyPoints.pricingDiscussed.agentInitiated ? '✓ Agent proactively discussed pricing' : 'Member asked about pricing'}
                    </p>
                  )}
                </div>
              )}

              {/* Re-Analyze Button - shows when analysis appears incomplete */}
              {showReanalyzeButton && (
                <div className="flex items-center gap-3 p-4 bg-warning/5 rounded-lg border border-warning/20">
                  <RefreshCw className="h-5 w-5 text-warning" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Incomplete Analysis Detected</p>
                    <p className="text-xs text-muted-foreground">Some insights may be missing. Re-analyze to extract more data.</p>
                  </div>
                  <Button 
                    onClick={handleReanalyzeCall} 
                    disabled={isReanalyzing}
                    size="sm"
                    variant="outline"
                  >
                    {isReanalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Re-Analyze Call
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Recovery Button - shows when transcription exists but Jeff's coaching is missing */}
              {showRecoveryButton && (
                <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <Wrench className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Jeff's Coaching Missing</p>
                    <p className="text-xs text-muted-foreground">Transcription exists but coaching feedback wasn't generated. Click to recover.</p>
                  </div>
                  <Button 
                    onClick={handleRecoverMissingCoaching} 
                    disabled={isRecoveringCoaching}
                    size="sm"
                    variant="outline"
                  >
                    {isRecoveringCoaching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Recovering...
                      </>
                    ) : (
                      <>
                        <Wrench className="mr-2 h-4 w-4" />
                        Recover Coaching
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Flagged Issues - shows which concerns triggered each detected issue */}
              {(() => {
                const issues = normalizeDetectedIssues(booking.detectedIssues);
                return issues.length > 0 && (
                  <div className="bg-amber-500/5 rounded-lg p-4 border border-amber-500/20">
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-amber-600">
                      <ShieldAlert className="h-4 w-4" />
                      Flagged Issues ({issues.length})
                    </h4>
                    <div className="space-y-3">
                      {issues.map((detail, i) => {
                        const config = ISSUE_BADGE_CONFIG[detail.issue];
                        return (
                          <div key={i} className={`rounded-md p-3 border ${config?.color || 'bg-muted text-muted-foreground border-border'}`}>
                            <p className="font-medium text-sm">{detail.issue}</p>
                            {detail.matchingConcerns.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                <p className="text-[10px] uppercase tracking-wider font-semibold opacity-70">Triggering Concerns</p>
                                {detail.matchingConcerns.map((concern, j) => (
                                  <p key={j} className="text-xs italic opacity-80">"{concern}"</p>
                                ))}
                              </div>
                            )}
                            {detail.matchingKeywords.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {detail.matchingKeywords.map((kw, k) => (
                                  <span key={k} className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-background/50 border border-current/10">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Key Insights Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Member Concerns */}
                {keyPoints?.memberConcerns && keyPoints.memberConcerns.length > 0 && (
                  <div className="bg-destructive/5 rounded-lg p-4 border border-destructive/20">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      Member Concerns
                    </h4>
                    <ul className="text-sm space-y-1">
                      {keyPoints.memberConcerns.map((concern, i) => (
                        <li key={i} className="text-muted-foreground">• {concern}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Member Preferences */}
                {keyPoints?.memberPreferences && keyPoints.memberPreferences.length > 0 && (
                  <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-primary">
                      <TrendingUp className="h-4 w-4" />
                      Member Preferences
                    </h4>
                    <ul className="text-sm space-y-1">
                      {keyPoints.memberPreferences.map((pref, i) => (
                        <li key={i} className="text-muted-foreground">• {pref}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Objections */}
                {keyPoints?.objections && keyPoints.objections.length > 0 && (
                  <div className="bg-warning/5 rounded-lg p-4 border border-warning/20">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-warning">
                      <AlertCircle className="h-4 w-4" />
                      Objections
                    </h4>
                    <ul className="text-sm space-y-1">
                      {keyPoints.objections.map((obj, i) => (
                        <li key={i} className="text-muted-foreground">• {obj}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommended Actions */}
                {keyPoints?.recommendedActions && keyPoints.recommendedActions.length > 0 && (
                  <div className="bg-success/5 rounded-lg p-4 border border-success/20">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-success">
                      <Lightbulb className="h-4 w-4" />
                      Recommended Actions
                    </h4>
                    <ul className="text-sm space-y-1">
                      {keyPoints.recommendedActions.map((action, i) => (
                        <li key={i} className="text-muted-foreground">• {action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Agent Feedback Section */}
              {agentFeedback && (
                <div className="space-y-4 border-t border-border pt-6">
                  <h4 className="font-semibold flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Agent Performance Feedback
                  </h4>
                  
                  {/* Overall Rating */}
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={getRatingColor(agentFeedback.overallRating)}>
                      <Award className="h-3 w-3 mr-1" />
                      Overall: {agentFeedback.overallRating?.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>

                  {/* Scores */}
                  {agentFeedback.scores && (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Communication', value: agentFeedback.scores.communication },
                        { label: 'Product Knowledge', value: agentFeedback.scores.productKnowledge },
                        { label: 'Objection Handling', value: agentFeedback.scores.objectionHandling },
                        { label: 'Closing Skills', value: agentFeedback.scores.closingSkills },
                      ].map((score) => (
                        <div key={score.label} className="bg-muted/30 rounded-lg p-3 border border-border">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-muted-foreground">{score.label}</span>
                            <span className="text-sm font-semibold">{score.value}/10</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${getScoreColor(score.value)}`}
                              style={{ width: `${score.value * 10}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Strengths & Improvements */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {agentFeedback.strengths && agentFeedback.strengths.length > 0 && (
                      <div className="bg-success/5 rounded-lg p-4 border border-success/20">
                        <h5 className="font-semibold mb-2 flex items-center gap-2 text-success text-sm">
                          <ThumbsUp className="h-4 w-4" />
                          Strengths
                        </h5>
                        <ul className="text-sm space-y-1">
                          {agentFeedback.strengths.map((s, i) => (
                            <li key={i} className="text-muted-foreground">• {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {agentFeedback.improvements && agentFeedback.improvements.length > 0 && (
                      <div className="bg-warning/5 rounded-lg p-4 border border-warning/20">
                        <h5 className="font-semibold mb-2 flex items-center gap-2 text-warning text-sm">
                          <TrendingUp className="h-4 w-4" />
                          Areas to Improve
                        </h5>
                        <ul className="text-sm space-y-1">
                          {agentFeedback.improvements.map((imp, i) => (
                            <li key={i} className="text-muted-foreground">• {imp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Coaching Tips */}
                  {agentFeedback.coachingTips && agentFeedback.coachingTips.length > 0 && (
                    <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                      <h5 className="font-semibold mb-2 flex items-center gap-2 text-primary text-sm">
                        <Lightbulb className="h-4 w-4" />
                        Coaching Tips
                      </h5>
                      <ul className="text-sm space-y-1">
                        {agentFeedback.coachingTips.map((tip, i) => (
                          <li key={i} className="text-muted-foreground">• {tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Full Transcript */}
              {callTranscription && (
                <Collapsible open={showFullTranscript} onOpenChange={setShowFullTranscript}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Full Transcript
                      </span>
                      {showFullTranscript ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="bg-muted/20 rounded-lg p-4 mt-2 border border-border">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {callTranscription}
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
