import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FlaskConical, 
  Loader2, 
  RefreshCw, 
  Clock, 
  FileText, 
  DollarSign,
  TrendingDown,
  Trash2
} from 'lucide-react';

interface Comparison {
  id: string;
  booking_id: string | null;
  kixie_link: string;
  elevenlabs_transcription: string | null;
  elevenlabs_word_count: number | null;
  elevenlabs_char_count: number | null;
  elevenlabs_latency_ms: number | null;
  deepgram_transcription: string | null;
  deepgram_word_count: number | null;
  deepgram_char_count: number | null;
  deepgram_latency_ms: number | null;
  deepgram_confidence: number | null;
  call_duration_seconds: number | null;
  audio_file_size_mb: number | null;
  created_at: string;
}

interface EligibleBooking {
  id: string;
  member_name: string;
  booking_date: string;
  kixie_link: string;
  call_duration_seconds: number | null;
}

export function STTComparisonPanel() {
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [eligibleBookings, setEligibleBookings] = useState<EligibleBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningComparison, setRunningComparison] = useState<string | null>(null);
  const [selectedComparison, setSelectedComparison] = useState<Comparison | null>(null);

  useEffect(() => {
    fetchComparisons();
    fetchEligibleBookings();
  }, []);

  const fetchComparisons = async () => {
    const { data, error } = await supabase
      .from('stt_quality_comparisons')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching comparisons:', error);
      return;
    }
    
    setComparisons((data || []) as Comparison[]);
  };

  const fetchEligibleBookings = async () => {
    // Find bookings with kixie_link that haven't been compared yet
    const { data, error } = await supabase
      .from('bookings')
      .select('id, member_name, booking_date, kixie_link, call_duration_seconds')
      .not('kixie_link', 'is', null)
      .eq('transcription_status', 'completed')
      .order('booking_date', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching eligible bookings:', error);
      return;
    }

    // Filter out already compared bookings
    const comparedIds = comparisons.map(c => c.booking_id);
    const eligible = (data || []).filter(b => !comparedIds.includes(b.id));
    setEligibleBookings(eligible as EligibleBooking[]);
  };

  const runComparison = async (bookingId: string, kixieUrl: string) => {
    setRunningComparison(bookingId);
    toast.info('Running side-by-side STT comparison...', { duration: 10000 });

    try {
      const { data, error } = await supabase.functions.invoke('compare-stt-providers', {
        body: { bookingId, kixieUrl }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Comparison complete! Review the results below.');
        fetchComparisons();
        fetchEligibleBookings();
      } else {
        throw new Error(data?.error || 'Comparison failed');
      }
    } catch (error) {
      console.error('Comparison error:', error);
      toast.error('Failed to run comparison. Check console for details.');
    } finally {
      setRunningComparison(null);
    }
  };

  const deleteComparison = async (id: string) => {
    const { error } = await supabase
      .from('stt_quality_comparisons')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete comparison');
      return;
    }

    toast.success('Comparison deleted');
    setComparisons(prev => prev.filter(c => c.id !== id));
    if (selectedComparison?.id === id) {
      setSelectedComparison(null);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateCost = (durationSeconds: number | null, provider: 'elevenlabs' | 'deepgram') => {
    if (!durationSeconds) return 'N/A';
    const rate = provider === 'elevenlabs' ? 0.034 : 0.0043;
    const cost = (durationSeconds / 60) * rate;
    return `$${cost.toFixed(4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-5 h-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">STT Quality Comparison</h3>
            <p className="text-sm text-muted-foreground">
              Compare ElevenLabs vs Deepgram transcription quality side-by-side
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchComparisons(); fetchEligibleBookings(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Eligible Bookings for Comparison */}
      {eligibleBookings.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-3">Select a call to compare:</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {eligibleBookings.slice(0, 5).map((booking) => (
              <div 
                key={booking.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
              >
                <div>
                  <p className="font-medium">{booking.member_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(booking.booking_date).toLocaleDateString()} • 
                    {formatDuration(booking.call_duration_seconds)}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => runComparison(booking.id, booking.kixie_link)}
                  disabled={runningComparison !== null}
                >
                  {runningComparison === booking.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Comparing...
                    </>
                  ) : (
                    <>
                      <FlaskConical className="w-4 h-4 mr-2" />
                      Compare
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Comparison Results */}
      {comparisons.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Comparisons List */}
          <Card className="p-4 lg:col-span-1">
            <h4 className="font-medium mb-3">Comparison History</h4>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {comparisons.map((comparison) => {
                  const durationMins = (comparison.call_duration_seconds || 0) / 60;
                  const elCost = durationMins * 0.034;
                  const dgCost = durationMins * 0.0043;
                  const savings = Math.round((1 - dgCost / elCost) * 100);

                  return (
                    <div
                      key={comparison.id}
                      onClick={() => setSelectedComparison(comparison)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedComparison?.id === comparison.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {formatDuration(comparison.call_duration_seconds)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          <TrendingDown className="w-3 h-3 mr-1" />
                          {savings}% savings
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>EL: {comparison.elevenlabs_char_count?.toLocaleString() || 0} chars</div>
                        <div>DG: {comparison.deepgram_char_count?.toLocaleString() || 0} chars</div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(comparison.created_at).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>

          {/* Selected Comparison Detail */}
          <Card className="p-4 lg:col-span-2">
            {selectedComparison ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Comparison Details</h4>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => deleteComparison(selectedComparison.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>

                {/* Metrics Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Clock className="w-4 h-4" />
                      Duration
                    </div>
                    <p className="font-semibold">{formatDuration(selectedComparison.call_duration_seconds)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <FileText className="w-4 h-4" />
                      EL Chars
                    </div>
                    <p className="font-semibold">{selectedComparison.elevenlabs_char_count?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <FileText className="w-4 h-4" />
                      DG Chars
                    </div>
                    <p className="font-semibold">{selectedComparison.deepgram_char_count?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <DollarSign className="w-4 h-4" />
                      Savings
                    </div>
                    <p className="font-semibold text-green-600">
                      {calculateCost(selectedComparison.call_duration_seconds, 'elevenlabs')} → {calculateCost(selectedComparison.call_duration_seconds, 'deepgram')}
                    </p>
                  </div>
                </div>

                {/* Latency Comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border">
                    <p className="text-sm text-muted-foreground mb-1">ElevenLabs Latency</p>
                    <p className="font-semibold">
                      {selectedComparison.elevenlabs_latency_ms 
                        ? `${(selectedComparison.elevenlabs_latency_ms / 1000).toFixed(1)}s` 
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-sm text-muted-foreground mb-1">Deepgram Latency</p>
                    <p className="font-semibold">
                      {selectedComparison.deepgram_latency_ms 
                        ? `${(selectedComparison.deepgram_latency_ms / 1000).toFixed(1)}s` 
                        : 'N/A'}
                    </p>
                    {selectedComparison.deepgram_confidence && (
                      <p className="text-xs text-muted-foreground">
                        Confidence: {(selectedComparison.deepgram_confidence * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>

                {/* Transcript Comparison */}
                <Tabs defaultValue="elevenlabs" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="elevenlabs">ElevenLabs Transcript</TabsTrigger>
                    <TabsTrigger value="deepgram">Deepgram Transcript</TabsTrigger>
                  </TabsList>
                  <TabsContent value="elevenlabs">
                    <ScrollArea className="h-[250px] border rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">
                        {selectedComparison.elevenlabs_transcription || 'No transcription available'}
                      </p>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="deepgram">
                    <ScrollArea className="h-[250px] border rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">
                        {selectedComparison.deepgram_transcription || 'No transcription available'}
                      </p>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <FlaskConical className="w-12 h-12 mb-3 opacity-50" />
                <p>Select a comparison to view details</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {comparisons.length === 0 && eligibleBookings.length === 0 && (
        <Card className="p-8 text-center">
          <FlaskConical className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            No comparisons yet. Process some calls with transcriptions to start comparing.
          </p>
        </Card>
      )}
    </div>
  );
}
