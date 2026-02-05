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
   DollarSign,
   TrendingDown,
   Trash2,
   Zap,
   Brain
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
 }
 
 export function LLMComparisonPanel() {
   const [comparisons, setComparisons] = useState<LLMComparison[]>([]);
   const [eligibleBookings, setEligibleBookings] = useState<EligibleBooking[]>([]);
   const [loading, setLoading] = useState(false);
   const [runningComparison, setRunningComparison] = useState<string | null>(null);
   const [selectedComparison, setSelectedComparison] = useState<LLMComparison | null>(null);
 
   useEffect(() => {
     fetchComparisons();
     fetchEligibleBookings();
   }, []);
 
   const fetchComparisons = async () => {
     const { data, error } = await supabase
       .from('llm_quality_comparisons')
       .select('*')
       .order('created_at', { ascending: false })
       .limit(20);
 
     if (error) {
       console.error('Error fetching LLM comparisons:', error);
       return;
     }
     
     setComparisons((data || []) as LLMComparison[]);
   };
 
   const fetchEligibleBookings = async () => {
     // Find bookings with completed transcription that haven't been LLM-compared yet
     const { data: comparedIds } = await supabase
       .from('llm_quality_comparisons')
       .select('booking_id')
       .not('booking_id', 'is', null);
 
     const excludeIds = (comparedIds || []).map(c => c.booking_id).filter(Boolean);
 
     let query = supabase
       .from('bookings')
       .select('id, member_name, booking_date, call_duration_seconds')
       .eq('transcription_status', 'completed')
       .order('booking_date', { ascending: false })
       .limit(20);
 
     if (excludeIds.length > 0) {
       query = query.not('id', 'in', `(${excludeIds.join(',')})`);
     }
 
     const { data, error } = await query;
 
     if (error) {
       console.error('Error fetching eligible bookings:', error);
       return;
     }
 
     setEligibleBookings((data || []) as EligibleBooking[]);
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
         <Button variant="outline" size="sm" onClick={() => { fetchComparisons(); fetchEligibleBookings(); }}>
           <RefreshCw className="w-4 h-4 mr-2" />
           Refresh
         </Button>
       </div>
 
       {/* Eligible Bookings for Comparison */}
       {eligibleBookings.length > 0 && (
         <Card className="p-4">
           <h4 className="font-medium mb-3">Select a transcribed call to compare:</h4>
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
                         <Badge variant="secondary" className="text-xs bg-cyan-500/10 text-cyan-600 border-cyan-500/20">
                           <TrendingDown className="w-3 h-3 mr-1" />
                           {savings}% savings
                         </Badge>
                       </div>
                       <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                         <div>Gemini: {formatCost(comparison.gemini_estimated_cost)}</div>
                         <div>DeepSeek: {formatCost(comparison.deepseek_estimated_cost)}</div>
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
 
       {comparisons.length === 0 && eligibleBookings.length === 0 && (
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