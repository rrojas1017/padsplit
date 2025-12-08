import { useState, useEffect } from 'react';
import { Booking } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBookingDetails } from '@/hooks/useBookingDetails';
import { CoachingAudioPlayer } from '@/components/coaching/CoachingAudioPlayer';
import { MemberDetailsCard } from './MemberDetailsCard';
import { 
  Mic, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp,
  AlertCircle, Target, Volume2
} from 'lucide-react';

interface CallInsightsProps {
  booking: Booking;
  onTranscriptionComplete: () => void;
}

export function CallInsights({ booking, onTranscriptionComplete }: CallInsightsProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranscriptionOpen, setIsTranscriptionOpen] = useState(false);
  
  const { fetchBookingDetails, isLoadingDetails, detailsCache } = useBookingDetails();
  const [loadedDetails, setLoadedDetails] = useState<any>(null);

  useEffect(() => {
    if (booking.transcriptionStatus === 'completed') {
      if (detailsCache[booking.id]) {
        setLoadedDetails(detailsCache[booking.id]);
      } else {
        fetchBookingDetails(booking.id).then(details => {
          if (details) setLoadedDetails(details);
        });
      }
    }
  }, [booking.transcriptionStatus, booking.id, fetchBookingDetails, detailsCache]);

  const handleTranscribe = async () => {
    if (!booking.kixieLink) return;
    setIsTranscribing(true);
    try {
      const { error } = await supabase.functions.invoke('transcribe-call', {
        body: { bookingId: booking.id, kixieUrl: booking.kixieLink },
      });
      if (error) throw error;
      toast.success('Transcription started');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to transcribe');
    } finally {
      setIsTranscribing(false);
    }
  };

  const callKeyPoints = loadedDetails?.callKeyPoints;
  const callSummary = loadedDetails?.callSummary;
  const callTranscription = loadedDetails?.callTranscription;
  const agentFeedback = loadedDetails?.agentFeedback;
  const coachingAudioUrl = loadedDetails?.coachingAudioUrl;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!booking.kixieLink) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mic className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Call Recording</h3>
          {booking.transcriptionStatus === 'completed' && <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>}
          {booking.transcriptionStatus === 'processing' && <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>}
          {booking.transcriptionStatus === 'failed' && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>}
          {!booking.transcriptionStatus && <Badge variant="outline">Not Transcribed</Badge>}
        </div>
        {(!booking.transcriptionStatus || booking.transcriptionStatus === 'failed') && (
          <Button onClick={handleTranscribe} disabled={isTranscribing} size="sm">
            {isTranscribing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Transcribing...</> : <><Mic className="h-4 w-4 mr-2" />Transcribe</>}
          </Button>
        )}
      </div>

      {booking.transcriptionStatus === 'completed' && (isLoadingDetails ? (
        <Card><CardContent className="py-8 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /><span className="ml-2">Loading...</span></CardContent></Card>
      ) : callKeyPoints && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-4 w-4 text-primary" />Call Summary</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{callSummary || callKeyPoints.summary}</p>
              <div className="flex flex-wrap gap-4 mt-3">
                {callKeyPoints.moveInReadiness && <Badge className={callKeyPoints.moveInReadiness === 'high' ? 'bg-green-600' : callKeyPoints.moveInReadiness === 'medium' ? 'bg-yellow-600' : 'bg-red-600'}>{callKeyPoints.moveInReadiness}</Badge>}
                {booking.callDurationSeconds && <Badge variant="secondary">{formatDuration(booking.callDurationSeconds)}</Badge>}
              </div>
            </CardContent>
          </Card>

          {/* Member Details Card */}
          {callKeyPoints?.memberDetails && (
            <MemberDetailsCard 
              memberDetails={callKeyPoints.memberDetails}
              memberName={booking.memberName}
            />
          )}

          {agentFeedback && (
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 mb-3">
                  <Volume2 className="h-5 w-5 text-accent" />
                  <p className="text-sm font-medium">Audio Coaching</p>
                </div>
                <CoachingAudioPlayer bookingId={booking.id} audioUrl={coachingAudioUrl} onAudioGenerated={onTranscriptionComplete} variant="card" />
              </CardContent>
            </Card>
          )}

          {callTranscription && (
            <Collapsible open={isTranscriptionOpen} onOpenChange={setIsTranscriptionOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Full Transcript</span>
                      {isTranscriptionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="max-h-64 overflow-y-auto p-3 bg-muted/30 rounded-md">
                      <p className="text-sm whitespace-pre-wrap">{callTranscription}</p>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </div>
      ))}
    </div>
  );
}