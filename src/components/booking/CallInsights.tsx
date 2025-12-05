import { useState } from 'react';
import { Booking } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { CoachingAudioPlayer } from '@/components/coaching/CoachingAudioPlayer';
import { 
  Mic, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  Heart,
  Lightbulb,
  ListTodo,
  AlertTriangle,
  Target,
  GraduationCap,
  Volume2
} from 'lucide-react';

interface CallInsightsProps {
  booking: Booking;
  onTranscriptionComplete: () => void;
}

export function CallInsights({ booking, onTranscriptionComplete }: CallInsightsProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isTranscriptionOpen, setIsTranscriptionOpen] = useState(false);
  const { user } = useAuth();
  
  // Only supervisors, admins, and super_admins can regenerate coaching
  const canRegenerateCoaching = user && ['super_admin', 'admin', 'supervisor'].includes(user.role);

  const handleTranscribe = async () => {
    if (!booking.kixieLink) {
      toast.error('No call recording URL available');
      return;
    }

    setIsTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-call', {
        body: {
          bookingId: booking.id,
          kixieUrl: booking.kixieLink,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast.success('Call transcription completed successfully');
        onTranscriptionComplete();
      } else {
        throw new Error(data?.error || 'Transcription failed');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to transcribe call');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleRegenerateCoaching = async () => {
    setIsRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-coaching', {
        body: { bookingId: booking.id }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Coaching feedback regenerated successfully');
        onTranscriptionComplete();
      } else {
        throw new Error(data?.error || 'Failed to regenerate coaching');
      }
    } catch (error) {
      console.error('Regenerate coaching error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to regenerate coaching');
    } finally {
      setIsRegenerating(false);
    }
  };

  const getStatusBadge = () => {
    switch (booking.transcriptionStatus) {
      case 'processing':
        return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>;
      case 'completed':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
      default:
        return <Badge variant="outline" className="gap-1">Not Transcribed</Badge>;
    }
  };

  const getReadinessBadge = (readiness: string) => {
    switch (readiness) {
      case 'high':
        return <Badge className="bg-green-600">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-600">Medium</Badge>;
      case 'low':
        return <Badge className="bg-red-600">Low</Badge>;
      default:
        return <Badge variant="outline">{readiness}</Badge>;
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <Badge className="bg-green-600">Positive</Badge>;
      case 'neutral':
        return <Badge variant="secondary">Neutral</Badge>;
      case 'negative':
        return <Badge variant="destructive">Negative</Badge>;
      default:
        return <Badge variant="outline">{sentiment}</Badge>;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't render if no Kixie link
  if (!booking.kixieLink) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mic className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Call Recording</h3>
          {getStatusBadge()}
        </div>
        
        {(!booking.transcriptionStatus || booking.transcriptionStatus === 'failed') && (
          <Button 
            onClick={handleTranscribe} 
            disabled={isTranscribing || booking.transcriptionStatus === 'processing'}
            size="sm"
          >
            {isTranscribing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transcribing...
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 mr-2" />
                Transcribe Call
              </>
            )}
          </Button>
        )}
      </div>

      {booking.transcriptionStatus === 'processing' && !isTranscribing && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-yellow-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Transcription in progress... This may take a few minutes.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {booking.transcriptionStatus === 'completed' && booking.callKeyPoints && (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" />
                Call Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{booking.callSummary || booking.callKeyPoints.summary}</p>
              <div className="flex flex-wrap gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Move-in Readiness:</span>
                  {getReadinessBadge(booking.callKeyPoints.moveInReadiness)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sentiment:</span>
                  {getSentimentBadge(booking.callKeyPoints.callSentiment)}
                </div>
                {booking.callDurationSeconds && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Duration:</span>
                    <Badge variant="secondary">{formatDuration(booking.callDurationSeconds)}</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Key Points Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Member Concerns */}
            {booking.callKeyPoints.memberConcerns?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-500" />
                    Member Concerns
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {booking.callKeyPoints.memberConcerns.map((concern, idx) => (
                      <li key={idx} className="text-muted-foreground">• {concern}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Member Preferences */}
            {booking.callKeyPoints.memberPreferences?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    Member Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {booking.callKeyPoints.memberPreferences.map((pref, idx) => (
                      <li key={idx} className="text-muted-foreground">• {pref}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Recommended Actions */}
            {booking.callKeyPoints.recommendedActions?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-green-500" />
                    Recommended Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {booking.callKeyPoints.recommendedActions.map((action, idx) => (
                      <li key={idx} className="text-muted-foreground">• {action}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Objections */}
            {booking.callKeyPoints.objections?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Objections Raised
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {booking.callKeyPoints.objections.map((obj, idx) => (
                      <li key={idx} className="text-muted-foreground">• {obj}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coaching Audio Player - shows when agent feedback exists */}
          {booking.agentFeedback && (
            <Card className="border-accent/30 bg-gradient-to-r from-accent/10 to-accent/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 mb-3">
                  <Volume2 className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium">Personalized Audio Coaching</p>
                    <p className="text-xs text-muted-foreground">
                      {booking.coachingAudioUrl 
                        ? 'Listen to your motivational feedback!' 
                        : 'Get an enthusiastic audio summary of your performance'}
                    </p>
                  </div>
                </div>
                <CoachingAudioPlayer
                  bookingId={booking.id}
                  audioUrl={booking.coachingAudioUrl}
                  onAudioGenerated={onTranscriptionComplete}
                  variant="card"
                />
              </CardContent>
            </Card>
          )}

          {/* Regenerate Coaching Button - shows when transcription complete but no agent feedback */}
          {/* Only supervisors, admins, and super_admins can generate coaching */}
          {booking.transcriptionStatus === 'completed' && !booking.agentFeedback && canRegenerateCoaching && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Coaching Insights Missing</p>
                      <p className="text-xs text-muted-foreground">This call was transcribed before coaching analysis was available.</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleRegenerateCoaching} 
                    disabled={isRegenerating}
                    size="sm"
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <GraduationCap className="h-4 w-4 mr-2" />
                        Generate Coaching
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full Transcription (Collapsible) */}
          {booking.callTranscription && (
            <Collapsible open={isTranscriptionOpen} onOpenChange={setIsTranscriptionOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        Full Transcription
                      </span>
                      {isTranscriptionOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="max-h-64 overflow-y-auto p-3 bg-muted/30 rounded-md">
                      <p className="text-sm whitespace-pre-wrap">{booking.callTranscription}</p>
                    </div>
                    {booking.transcribedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Transcribed: {new Date(booking.transcribedAt).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}
