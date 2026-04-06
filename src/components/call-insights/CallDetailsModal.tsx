import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Call } from '@/pages/CallInsights';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { 
  Phone, PhoneIncoming, PhoneOutgoing, Clock, User, Calendar,
  FileText, MessageSquare, Target, ChevronDown, ChevronUp,
  Play, ExternalLink, Loader2, Mic
} from 'lucide-react';
import { format } from 'date-fns';

interface CallDetailsModalProps {
  call: Call;
  agentName: string;
  onClose: () => void;
}

interface CallTranscription {
  id: string;
  call_transcription: string | null;
  call_summary: string | null;
  call_key_points: any;
  agent_feedback: any;
  qa_scores: any;
}

export function CallDetailsModal({ call, agentName, onClose }: CallDetailsModalProps) {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Fetch call transcription
  const { data: transcription, isLoading, refetch } = useQuery({
    queryKey: ['call-transcription', call.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_transcriptions')
        .select('*')
        .eq('call_id', call.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as CallTranscription | null;
    },
    enabled: call.transcription_status === 'completed',
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTranscribe = async () => {
    if (!call.recording_url) {
      toast.error('No recording URL available');
      return;
    }
    
    setIsTranscribing(true);
    try {
      const { error } = await supabase.functions.invoke('transcribe-call', {
        body: { callId: call.id, kixieUrl: call.recording_url },
      });
      if (error) throw error;
      toast.success('Transcription started');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to transcribe');
    } finally {
      setIsTranscribing(false);
    }
  };

  const keyPoints = transcription?.call_key_points;
  const agentFeedback = transcription?.agent_feedback;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {call.call_type === 'incoming' 
              ? <PhoneIncoming className="h-5 w-5 text-green-500" />
              : <PhoneOutgoing className="h-5 w-5 text-blue-500" />
            }
            Call Details
            {call.booking_id && (
              <Badge variant="outline" className="ml-2">Linked to Booking</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Call Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(call.call_date), 'MMM d, yyyy h:mm a')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Agent</p>
                  <p className="font-medium">{call.kixie_agent_name || agentName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-medium">{formatDuration(call.duration_seconds)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Contact</p>
                  <p className="font-medium">{call.contact_name || call.contact_phone || '--'}</p>
                </div>
              </div>
            </div>

            {/* Recording - proxied for cross-origin compatibility */}
            {call.recording_url && call.booking_id && (
              <ProxiedAudioPlayer bookingId={call.booking_id} />
            )}
            {call.recording_url && !call.booking_id && (
              <Card>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Play className="h-5 w-5 text-primary" />
                    <span className="font-medium">Call Recording</span>
                  </div>
                  <audio
                    controls
                    src={call.recording_url}
                    className="w-full h-10 rounded-lg"
                    preload="metadata"
                  />
                </CardContent>
              </Card>
            )}

            {/* Transcription Status / Button */}
            {call.transcription_status !== 'completed' && (
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mic className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Transcription</p>
                        <p className="text-sm text-muted-foreground">
                          {call.transcription_status === 'processing' 
                            ? 'Processing...' 
                            : call.transcription_status === 'failed'
                            ? 'Failed - Try again'
                            : 'Not yet transcribed'}
                        </p>
                      </div>
                    </div>
                    {call.recording_url && (
                      <Button 
                        onClick={handleTranscribe} 
                        disabled={isTranscribing || call.transcription_status === 'processing'}
                        size="sm"
                      >
                        {isTranscribing || call.transcription_status === 'processing' ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                        ) : (
                          <><Mic className="h-4 w-4 mr-2" />Transcribe</>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transcription Content */}
            {call.transcription_status === 'completed' && (
              isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : transcription ? (
                <Tabs defaultValue="summary" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="feedback">Coaching</TabsTrigger>
                    <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="space-y-4">
                    {/* Summary */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          Call Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {transcription.call_summary || keyPoints?.summary || 'No summary available'}
                        </p>
                        {keyPoints?.moveInReadiness && (
                          <div className="mt-3 flex gap-2">
                            <Badge className={
                              keyPoints.moveInReadiness === 'high' ? 'bg-green-600' :
                              keyPoints.moveInReadiness === 'medium' ? 'bg-yellow-600' : 'bg-red-600'
                            }>
                              {keyPoints.moveInReadiness} readiness
                            </Badge>
                            {keyPoints?.callSentiment && (
                              <Badge variant="outline">{keyPoints.callSentiment} sentiment</Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Key Points */}
                    {keyPoints && (
                      <>
                        {keyPoints.memberConcerns?.length > 0 && (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">Member Concerns</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                {keyPoints.memberConcerns.map((c: string, i: number) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )}

                        {keyPoints.objections?.length > 0 && (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">Objections</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                {keyPoints.objections.map((o: string, i: number) => (
                                  <li key={i}>{o}</li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="feedback" className="space-y-4">
                    {agentFeedback ? (
                      <>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              Overall Rating
                              <Badge>{agentFeedback.overallRating}</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {agentFeedback.strengths?.length > 0 && (
                              <div>
                                <p className="font-medium text-green-600 mb-1">Strengths</p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground">
                                  {agentFeedback.strengths.map((s: string, i: number) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {agentFeedback.improvements?.length > 0 && (
                              <div>
                                <p className="font-medium text-orange-600 mb-1">Areas for Improvement</p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground">
                                  {agentFeedback.improvements.map((i: string, idx: number) => (
                                    <li key={idx}>{i}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {agentFeedback.coachingTips?.length > 0 && (
                              <div>
                                <p className="font-medium text-primary mb-1">Coaching Tips</p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground">
                                  {agentFeedback.coachingTips.map((t: string, i: number) => (
                                    <li key={i}>{t}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          No coaching feedback available
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="transcript">
                    <Card>
                      <CardContent className="py-4">
                        <ScrollArea className="h-[400px]">
                          <p className="text-sm whitespace-pre-wrap">
                            {transcription.call_transcription || 'No transcript available'}
                          </p>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No transcription data available
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
