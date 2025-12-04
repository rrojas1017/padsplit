import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, ChevronDown, ChevronUp, Mic, AlertCircle, CheckCircle2, Clock, TrendingUp, MessageSquare, Target, AlertTriangle, Lightbulb, Smile, Meh, Frown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Booking, CallKeyPoints } from '@/types';

interface TranscriptionModalProps {
  booking: Booking;
  isOpen: boolean;
  onClose: () => void;
  onTranscriptionComplete: () => void;
}

export function TranscriptionModal({ booking, isOpen, onClose, onTranscriptionComplete }: TranscriptionModalProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const { toast } = useToast();

  const handleTranscribe = async () => {
    if (!booking.kixieLink) return;
    
    setIsTranscribing(true);
    
    toast({
      title: "Starting Transcription",
      description: `Processing call for ${booking.memberName}...`,
    });
    
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-call', {
        body: { 
          bookingId: booking.id,
          kixieUrl: booking.kixieLink
        }
      });

      if (error) throw error;

      toast({
        title: "Transcription Complete",
        description: "Call has been transcribed and analyzed successfully.",
      });
      
      onTranscriptionComplete();
    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: "Transcription Failed",
        description: error instanceof Error ? error.message : "Failed to transcribe call",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const keyPoints = booking.callKeyPoints as CallKeyPoints | null;
  const hasTranscription = booking.transcriptionStatus === 'completed' && booking.callSummary;

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
              {booking.transcriptionStatus === 'processing' || isTranscribing ? (
                <>
                  <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                  <p className="text-lg font-medium">Transcribing call...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This may take a minute depending on call length
                  </p>
                </>
              ) : booking.transcriptionStatus === 'failed' ? (
                <>
                  <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                  <p className="text-lg font-medium">Transcription Failed</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    There was an error processing this call recording
                  </p>
                  <Button onClick={handleTranscribe} disabled={isTranscribing}>
                    Try Again
                  </Button>
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
                        Transcribing...
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
              </div>

              {/* Summary */}
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Summary
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {booking.callSummary || keyPoints?.summary}
                </p>
              </div>

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

              {/* Full Transcript */}
              {booking.callTranscription && (
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
                        {booking.callTranscription}
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
