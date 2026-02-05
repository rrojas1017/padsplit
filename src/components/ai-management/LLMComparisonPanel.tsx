import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FlaskConical, 
  Loader2, 
  RefreshCw, 
  Clock, 
  DollarSign,
  TrendingDown,
  Trash2,
  Zap,
  Brain,
  Settings2,
  Shield,
  Wand2,
  Edit3,
  Check
} from 'lucide-react';

interface LLMComparison {
  id: string;
  booking_id: string | null;
  transcription_text: string;
  call_duration_seconds: number | null;
  gemini_analysis: any;
  gemini_model: string | null;
  gemini_input_tokens: number | null;
  gemini_output_tokens: number | null;
  gemini_latency_ms: number | null;
  gemini_estimated_cost: number | null;
  deepseek_analysis: any;
  deepseek_model: string | null;
  deepseek_input_tokens: number | null;
  deepseek_output_tokens: number | null;
  deepseek_latency_ms: number | null;
  deepseek_estimated_cost: number | null;
  comparison_notes: string | null;
  created_at: string;
}

interface EligibleBooking {
  id: string;
  member_name: string;
  booking_date: string;
  call_duration_seconds: number | null;
  status: string | null;
}

interface ComparisonWithBookingStatus extends LLMComparison {
  bookingStatus?: string | null;
}

interface LLMProviderSettings {
  id: string;
  provider_name: string;
  weight: number;
  is_active: boolean;
  api_config: any;
}

interface ProviderStats {
  deepseek_count: number;
  gemini_count: number;
  total: number;
}

interface PromptEnhancement {
  id: string;
  provider_name: string;
  enhancement_type: string;
  content: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
 
export function LLMComparisonPanel() {
  const [comparisons, setComparisons] = useState<ComparisonWithBookingStatus[]>([]);
  const [nonBookingCalls, setNonBookingCalls] = useState<EligibleBooking[]>([]);
  const [otherBookings, setOtherBookings] = useState<EligibleBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningComparison, setRunningComparison] = useState<string | null>(null);
  const [selectedComparison, setSelectedComparison] = useState<LLMComparison | null>(null);
  
  // Hybrid mode state
  const [providerSettings, setProviderSettings] = useState<LLMProviderSettings[]>([]);
  const [hybridModeEnabled, setHybridModeEnabled] = useState(false);
  const [nonBookingFallback, setNonBookingFallback] = useState(true);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [providerStats, setProviderStats] = useState<ProviderStats>({ deepseek_count: 0, gemini_count: 0, total: 0 });

  useEffect(() => {
    fetchComparisons();
    fetchEligibleBookings();
    fetchProviderSettings();
    fetchProviderStats();
  }, []);

  const fetchProviderSettings = async () => {
    const { data, error } = await supabase
      .from('llm_provider_settings')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching LLM provider settings:', error);
      return;
    }

    setProviderSettings(data || []);
    
    // Check if hybrid mode is enabled (DeepSeek has 100% weight AND has fallback conditions)
    const deepseekSettings = data?.find(s => s.provider_name === 'deepseek');
    const geminiSettings = data?.find(s => s.provider_name === 'lovable_ai');
    
    // Hybrid mode = DeepSeek has 100% weight but has fallback conditions
    const deepseekWeight = deepseekSettings?.weight || 0;
    const geminiWeight = geminiSettings?.weight || 0;
    const fallbackConditions = (deepseekSettings?.api_config as any)?.use_gemini_fallback_for || [];
    
    setHybridModeEnabled(deepseekWeight === 100 && geminiWeight === 0 && fallbackConditions.length > 0);
    setNonBookingFallback(fallbackConditions.includes('non_booking'));
  };

  const fetchProviderStats = async () => {
    // Get counts of transcriptions by LLM provider from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('booking_transcriptions')
      .select('llm_provider')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('Error fetching provider stats:', error);
      return;
    }

    const stats = {
      deepseek_count: data?.filter(t => t.llm_provider === 'deepseek').length || 0,
      gemini_count: data?.filter(t => t.llm_provider === 'lovable_ai' || !t.llm_provider).length || 0,
      total: data?.length || 0
    };
    
    setProviderStats(stats);
  };

  const fetchComparisons = async () => {
    const { data, error } = await supabase
      .from('llm_quality_comparisons')
      .select('*, bookings(status)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching LLM comparisons:', error);
      return;
    }
    
    // Map to include booking status
    const comparisonsWithStatus: ComparisonWithBookingStatus[] = (data || []).map((c: any) => ({
      ...c,
      bookingStatus: c.bookings?.status || null
    }));
    
    setComparisons(comparisonsWithStatus);
  };

  const fetchEligibleBookings = async () => {
    // Find bookings with completed transcription that haven't been LLM-compared yet
    const { data: comparedIds } = await supabase
      .from('llm_quality_comparisons')
      .select('booking_id')
      .not('booking_id', 'is', null);

    const excludeIds = (comparedIds || []).map(c => c.booking_id).filter(Boolean);

    // Query for Non-Booking calls specifically (for readiness testing)
    let nonBookingQuery = supabase
      .from('bookings')
      .select('id, member_name, booking_date, call_duration_seconds, status')
      .eq('transcription_status', 'completed')
      .eq('status', 'Non Booking')
      .order('booking_date', { ascending: false })
      .limit(5);

    if (excludeIds.length > 0) {
      nonBookingQuery = nonBookingQuery.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    // Query for other bookings
    let otherQuery = supabase
      .from('bookings')
      .select('id, member_name, booking_date, call_duration_seconds, status')
      .eq('transcription_status', 'completed')
      .neq('status', 'Non Booking')
      .order('booking_date', { ascending: false })
      .limit(10);

    if (excludeIds.length > 0) {
      otherQuery = otherQuery.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const [nonBookingResult, otherResult] = await Promise.all([
      nonBookingQuery,
      otherQuery
    ]);

    if (nonBookingResult.error) {
      console.error('Error fetching non-booking calls:', nonBookingResult.error);
    } else {
      setNonBookingCalls((nonBookingResult.data || []) as EligibleBooking[]);
    }

    if (otherResult.error) {
      console.error('Error fetching other bookings:', otherResult.error);
    } else {
      setOtherBookings((otherResult.data || []) as EligibleBooking[]);
    }
  };

  const toggleHybridMode = async (enabled: boolean) => {
    setUpdatingSettings(true);
    
    try {
      if (enabled) {
        // Enable hybrid mode: Set DeepSeek to 100%, Gemini to 0%, add fallback conditions
        await supabase
          .from('llm_provider_settings')
          .update({ weight: 100, api_config: { 
            model: 'deepseek-chat',
            use_gemini_fallback_for: ['non_booking', 'negative_sentiment'],
            enable_two_pass_sentiment: true
          }})
          .eq('provider_name', 'deepseek');
        
        await supabase
          .from('llm_provider_settings')
          .update({ weight: 0 })
          .eq('provider_name', 'lovable_ai');
          
        toast.success('Hybrid mode enabled - DeepSeek default with Gemini fallback for edge cases');
      } else {
        // Disable hybrid mode: Set Gemini back to 100%, DeepSeek to 0%
        await supabase
          .from('llm_provider_settings')
          .update({ weight: 0, api_config: { model: 'deepseek-chat' }})
          .eq('provider_name', 'deepseek');
        
        await supabase
          .from('llm_provider_settings')
          .update({ weight: 100 })
          .eq('provider_name', 'lovable_ai');
          
        toast.success('Hybrid mode disabled - Using Gemini only');
      }
      
      setHybridModeEnabled(enabled);
      fetchProviderSettings();
    } catch (error) {
      console.error('Error updating hybrid mode:', error);
      toast.error('Failed to update hybrid mode settings');
    } finally {
      setUpdatingSettings(false);
    }
  };

  const toggleNonBookingFallback = async (enabled: boolean) => {
    setUpdatingSettings(true);
    
    try {
      const deepseekSettings = providerSettings.find(s => s.provider_name === 'deepseek');
      const currentConfig = (deepseekSettings?.api_config as any) || {};
      const currentFallbacks = currentConfig.use_gemini_fallback_for || [];
      
      let newFallbacks: string[];
      if (enabled) {
        newFallbacks = [...new Set([...currentFallbacks, 'non_booking'])];
      } else {
        newFallbacks = currentFallbacks.filter((f: string) => f !== 'non_booking');
      }
      
      await supabase
        .from('llm_provider_settings')
        .update({ api_config: { ...currentConfig, use_gemini_fallback_for: newFallbacks }})
        .eq('provider_name', 'deepseek');
      
      setNonBookingFallback(enabled);
      toast.success(`Non-booking fallback ${enabled ? 'enabled' : 'disabled'}`);
      fetchProviderSettings();
    } catch (error) {
      console.error('Error updating fallback setting:', error);
      toast.error('Failed to update fallback settings');
    } finally {
      setUpdatingSettings(false);
    }
  };
 
   const runComparison = async (bookingId: string) => {
     setRunningComparison(bookingId);
     toast.info('Running LLM comparison (Gemini vs DeepSeek)...', { duration: 15000 });
 
     try {
       const { data, error } = await supabase.functions.invoke('compare-llm-providers', {
         body: { bookingId }
       });
 
       if (error) throw error;
 
       if (data?.success) {
         const savings = data.costSavings?.percentage?.toFixed(0) || 0;
         toast.success(`Comparison complete! DeepSeek is ${savings}% cheaper.`);
         fetchComparisons();
         fetchEligibleBookings();
       } else {
         throw new Error(data?.error || 'Comparison failed');
       }
     } catch (error) {
       console.error('LLM Comparison error:', error);
       toast.error('Failed to run comparison. Check console for details.');
     } finally {
       setRunningComparison(null);
     }
   };
 
   const deleteComparison = async (id: string) => {
     const { error } = await supabase
       .from('llm_quality_comparisons')
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
 
   const formatCost = (cost: number | null) => {
     if (cost === null || cost === undefined) return 'N/A';
     return `$${cost.toFixed(5)}`;
   };
 
   const formatTokens = (input: number | null, output: number | null) => {
     const i = input || 0;
     const o = output || 0;
     return `${i.toLocaleString()} / ${o.toLocaleString()}`;
   };
 
   return (
    <div className="space-y-6">
      {/* Hybrid Mode Settings Card */}
      <Card className="p-4 border-2 border-accent/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Settings2 className="w-5 h-5 text-accent" />
            <div>
              <h3 className="font-semibold text-foreground">Hybrid LLM Mode</h3>
              <p className="text-sm text-muted-foreground">
                DeepSeek default (~41% savings) with Gemini fallback for edge cases
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              checked={hybridModeEnabled} 
              onCheckedChange={toggleHybridMode}
              disabled={updatingSettings}
            />
            <Label className="text-sm">{hybridModeEnabled ? 'Enabled' : 'Disabled'}</Label>
          </div>
        </div>
        
        {hybridModeEnabled && (
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Use Gemini for Non-Booking calls</span>
              </div>
              <Switch 
                checked={nonBookingFallback} 
                onCheckedChange={toggleNonBookingFallback}
                disabled={updatingSettings}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-muted/50">
                <div className="font-semibold text-foreground">{providerStats.deepseek_count}</div>
                <div className="text-muted-foreground">DeepSeek</div>
              </div>
              <div className="p-2 rounded bg-muted/50">
                <div className="font-semibold text-foreground">{providerStats.gemini_count}</div>
                <div className="text-muted-foreground">Gemini</div>
              </div>
              <div className="p-2 rounded bg-muted/50">
                <div className="font-semibold text-foreground">{providerStats.total}</div>
                <div className="text-muted-foreground">Total (30d)</div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">LLM Quality Comparison</h3>
            <p className="text-sm text-muted-foreground">
              Compare Gemini vs DeepSeek analysis quality and cost side-by-side
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchComparisons(); fetchEligibleBookings(); fetchProviderStats(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
 
       {/* Non-Booking Calls for Readiness Testing */}
       {nonBookingCalls.length > 0 && (
         <Card className="p-4 border-2 border-destructive/30 bg-destructive/5">
           <div className="flex items-center gap-2 mb-3">
             <Badge variant="destructive" className="text-xs">Non-Booking Test</Badge>
             <h4 className="font-medium">Test DeepSeek readiness detection accuracy</h4>
           </div>
           <p className="text-sm text-muted-foreground mb-3">
             Non-Booking calls are routed to Gemini by default. Use these to verify DeepSeek quality for edge cases.
           </p>
           <div className="space-y-2 max-h-48 overflow-y-auto">
             {nonBookingCalls.map((booking) => (
               <div 
                 key={booking.id}
                 className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
               >
                 <div className="flex items-center gap-3">
                   <Badge variant="destructive" className="text-xs shrink-0">
                     Non Booking
                   </Badge>
                   <div>
                     <p className="font-medium">{booking.member_name}</p>
                     <p className="text-sm text-muted-foreground">
                       {new Date(booking.booking_date).toLocaleDateString()} • 
                       {formatDuration(booking.call_duration_seconds)}
                     </p>
                   </div>
                 </div>
                 <Button
                   size="sm"
                   variant="destructive"
                   onClick={() => runComparison(booking.id)}
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

       {/* Other Eligible Bookings for Comparison */}
       {otherBookings.length > 0 && (
         <Card className="p-4">
           <h4 className="font-medium mb-3">Other eligible calls:</h4>
           <div className="space-y-2 max-h-48 overflow-y-auto">
             {otherBookings.slice(0, 7).map((booking) => (
               <div 
                 key={booking.id}
                 className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
               >
                 <div className="flex items-center gap-3">
                   <Badge variant="secondary" className="text-xs shrink-0">
                     {booking.status || 'Unknown'}
                   </Badge>
                   <div>
                     <p className="font-medium">{booking.member_name}</p>
                     <p className="text-sm text-muted-foreground">
                       {new Date(booking.booking_date).toLocaleDateString()} • 
                       {formatDuration(booking.call_duration_seconds)}
                     </p>
                   </div>
                 </div>
                 <Button
                   size="sm"
                   onClick={() => runComparison(booking.id)}
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
                    const geminiCost = comparison.gemini_estimated_cost || 0;
                    const deepseekCost = comparison.deepseek_estimated_cost || 0;
                    const savings = geminiCost > 0 
                      ? Math.round((1 - deepseekCost / geminiCost) * 100) 
                      : 0;
                    const isNonBooking = comparison.bookingStatus === 'Non Booking';
                    
                    // Extract readiness levels from analysis
                    const geminiReadiness = comparison.gemini_analysis?.callKeyPoints?.moveInReadiness || 'N/A';
                    const deepseekReadiness = comparison.deepseek_analysis?.callKeyPoints?.moveInReadiness || 'N/A';
                    const readinessMismatch = geminiReadiness !== deepseekReadiness;
 
                    return (
                      <div
                        key={comparison.id}
                        onClick={() => setSelectedComparison(comparison)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedComparison?.id === comparison.id 
                            ? 'border-primary bg-primary/5' 
                            : isNonBooking 
                              ? 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
                              : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isNonBooking && (
                              <Badge variant="destructive" className="text-xs">Non Booking</Badge>
                            )}
                            <span className="text-sm font-medium">
                              {formatDuration(comparison.call_duration_seconds)}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs bg-cyan-500/10 text-cyan-600 border-cyan-500/20">
                            <TrendingDown className="w-3 h-3 mr-1" />
                            {savings}% savings
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>Gemini: {formatCost(comparison.gemini_estimated_cost)}</div>
                          <div>DeepSeek: {formatCost(comparison.deepseek_estimated_cost)}</div>
                        </div>
                        {/* Readiness comparison for quality check */}
                        <div className={`mt-2 pt-2 border-t border-border/50 grid grid-cols-2 gap-2 text-xs ${readinessMismatch ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          <div>Gemini: {geminiReadiness}</div>
                          <div>DeepSeek: {deepseekReadiness}</div>
                        </div>
                        {readinessMismatch && (
                          <Badge variant="outline" className="mt-2 text-xs border-amber-500/50 text-amber-600 bg-amber-500/10">
                            ⚠️ Readiness mismatch
                          </Badge>
                        )}
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
                   <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                     <div className="flex items-center gap-2 text-sm text-blue-600 mb-1">
                       <DollarSign className="w-4 h-4" />
                       Gemini
                     </div>
                     <p className="font-semibold text-blue-600">{formatCost(selectedComparison.gemini_estimated_cost)}</p>
                   </div>
                   <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                     <div className="flex items-center gap-2 text-sm text-cyan-600 mb-1">
                       <DollarSign className="w-4 h-4" />
                       DeepSeek
                     </div>
                     <p className="font-semibold text-cyan-600">{formatCost(selectedComparison.deepseek_estimated_cost)}</p>
                   </div>
                   <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                     <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
                       <TrendingDown className="w-4 h-4" />
                       Savings
                     </div>
                     <p className="font-semibold text-green-600">
                       {selectedComparison.gemini_estimated_cost && selectedComparison.deepseek_estimated_cost
                         ? `${Math.round((1 - selectedComparison.deepseek_estimated_cost / selectedComparison.gemini_estimated_cost) * 100)}%`
                         : 'N/A'}
                     </p>
                   </div>
                 </div>
 
                 {/* Latency & Token Comparison */}
                 <div className="grid grid-cols-2 gap-3">
                   <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                     <p className="text-sm text-muted-foreground mb-1">Gemini ({selectedComparison.gemini_model})</p>
                     <p className="font-semibold">
                       {selectedComparison.gemini_latency_ms 
                         ? `${(selectedComparison.gemini_latency_ms / 1000).toFixed(1)}s latency` 
                         : 'N/A'}
                     </p>
                     <p className="text-xs text-muted-foreground">
                       Tokens: {formatTokens(selectedComparison.gemini_input_tokens, selectedComparison.gemini_output_tokens)}
                     </p>
                   </div>
                   <div className="p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                     <p className="text-sm text-muted-foreground mb-1">DeepSeek ({selectedComparison.deepseek_model})</p>
                     <p className="font-semibold">
                       {selectedComparison.deepseek_latency_ms 
                         ? `${(selectedComparison.deepseek_latency_ms / 1000).toFixed(1)}s latency` 
                         : 'N/A'}
                     </p>
                     <p className="text-xs text-muted-foreground">
                       Tokens: {formatTokens(selectedComparison.deepseek_input_tokens, selectedComparison.deepseek_output_tokens)}
                     </p>
                   </div>
                 </div>
 
                 {/* Analysis Comparison */}
                 <Tabs defaultValue="gemini" className="w-full">
                   <TabsList className="grid w-full grid-cols-2">
                     <TabsTrigger value="gemini" className="gap-2">
                       <Zap className="w-3 h-3" />
                       Gemini Analysis
                     </TabsTrigger>
                     <TabsTrigger value="deepseek" className="gap-2">
                       <Brain className="w-3 h-3" />
                       DeepSeek Analysis
                     </TabsTrigger>
                   </TabsList>
                   <TabsContent value="gemini">
                     <ScrollArea className="h-[250px] border rounded-lg p-3">
                       <pre className="text-sm whitespace-pre-wrap font-mono">
                         {selectedComparison.gemini_analysis 
                           ? JSON.stringify(selectedComparison.gemini_analysis, null, 2)
                           : 'No analysis available'}
                       </pre>
                     </ScrollArea>
                   </TabsContent>
                   <TabsContent value="deepseek">
                     <ScrollArea className="h-[250px] border rounded-lg p-3">
                       <pre className="text-sm whitespace-pre-wrap font-mono">
                         {selectedComparison.deepseek_analysis 
                           ? JSON.stringify(selectedComparison.deepseek_analysis, null, 2)
                           : 'No analysis available'}
                       </pre>
                     </ScrollArea>
                   </TabsContent>
                 </Tabs>
               </div>
             ) : (
               <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                 <Brain className="w-12 h-12 mb-3 opacity-50" />
                 <p>Select a comparison to view details</p>
               </div>
             )}
           </Card>
         </div>
       )}
 
       {comparisons.length === 0 && nonBookingCalls.length === 0 && otherBookings.length === 0 && (
          <Card className="p-8 text-center">
            <Brain className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              No comparisons yet. Process some calls with transcriptions to start comparing LLM providers.
            </p>
          </Card>
        )}
     </div>
   );
 }