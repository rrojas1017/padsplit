 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 // DeepSeek pricing per 1M tokens
 const DEEPSEEK_PRICING = {
   input: 0.27,
   output: 1.10,
 };
 
 // Gemini pricing per 1M tokens (Flash)
 const GEMINI_PRICING = {
   input: 0.30,
   output: 2.50,
 };
 
 function calculateDeepSeekCost(inputTokens: number, outputTokens: number): number {
   return (inputTokens / 1_000_000) * DEEPSEEK_PRICING.input + 
          (outputTokens / 1_000_000) * DEEPSEEK_PRICING.output;
 }
 
 function calculateGeminiCost(inputTokens: number, outputTokens: number): number {
   return (inputTokens / 1_000_000) * GEMINI_PRICING.input + 
          (outputTokens / 1_000_000) * GEMINI_PRICING.output;
 }
 
 function buildAnalysisPrompt(transcription: string): { system: string; user: string } {
   const systemPrompt = `You are an expert call analyst for PadSplit, a shared housing company. Your job is to analyze call transcriptions and extract structured information.
 
 You must respond with a valid JSON object containing the following fields:
 - callSummary: A 2-3 sentence summary of the call
 - memberDetails: { firstName, lastName, phoneNumber, email, householdSize, weeklyBudget, moveInDate, commitmentWeeks, preferredPaymentMethod, propertyAddress, marketCity, marketState }
 - callKeyPoints: { memberConcerns: string[], memberPreferences: string[], objections: string[], moveInReadiness: "high"|"medium"|"low", callSentiment: "positive"|"neutral"|"negative" }
 - agentFeedback: { overallRating: "excellent"|"good"|"needs_improvement"|"poor", strengths: string[], improvements: string[], scores: { communication: 1-10, productKnowledge: 1-10, objectionHandling: 1-10, closingSkills: 1-10 } }
 
 Only include fields where information is clearly stated or strongly implied. Use null for missing fields.`;
 
   const userPrompt = `Please analyze this call transcription and extract the structured information:
 
 ${transcription}`;
 
   return { system: systemPrompt, user: userPrompt };
 }
 
 async function callGemini(systemPrompt: string, userPrompt: string): Promise<{
   analysis: any;
   model: string;
   inputTokens: number;
   outputTokens: number;
   latencyMs: number;
 }> {
   const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
   if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
 
   const startTime = Date.now();
   
   const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
     method: "POST",
     headers: {
       Authorization: `Bearer ${LOVABLE_API_KEY}`,
       "Content-Type": "application/json",
     },
     body: JSON.stringify({
       model: "google/gemini-2.5-flash",
       messages: [
         { role: "system", content: systemPrompt },
         { role: "user", content: userPrompt },
       ],
       response_format: { type: "json_object" },
     }),
   });
 
   const latencyMs = Date.now() - startTime;
 
   if (!response.ok) {
     const errorText = await response.text();
     throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
   }
 
   const result = await response.json();
   const content = result.choices?.[0]?.message?.content || "{}";
   
   let analysis;
   try {
     analysis = JSON.parse(content);
   } catch {
     analysis = { raw: content, parseError: true };
   }
 
   return {
     analysis,
     model: "google/gemini-2.5-flash",
     inputTokens: result.usage?.prompt_tokens || 0,
     outputTokens: result.usage?.completion_tokens || 0,
     latencyMs,
   };
 }
 
 async function callDeepSeek(systemPrompt: string, userPrompt: string): Promise<{
   analysis: any;
   model: string;
   inputTokens: number;
   outputTokens: number;
   latencyMs: number;
 }> {
   const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
   if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not configured");
 
   const startTime = Date.now();
   
   const response = await fetch("https://api.deepseek.com/chat/completions", {
     method: "POST",
     headers: {
       Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
       "Content-Type": "application/json",
     },
     body: JSON.stringify({
       model: "deepseek-chat",
       messages: [
         { role: "system", content: systemPrompt },
         { role: "user", content: userPrompt },
       ],
       response_format: { type: "json_object" },
       stream: false,
     }),
   });
 
   const latencyMs = Date.now() - startTime;
 
   if (!response.ok) {
     const errorText = await response.text();
     throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
   }
 
   const result = await response.json();
   const content = result.choices?.[0]?.message?.content || "{}";
   
   let analysis;
   try {
     analysis = JSON.parse(content);
   } catch {
     analysis = { raw: content, parseError: true };
   }
 
   return {
     analysis,
     model: "deepseek-chat",
     inputTokens: result.usage?.prompt_tokens || 0,
     outputTokens: result.usage?.completion_tokens || 0,
     latencyMs,
   };
 }
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const authHeader = req.headers.get("Authorization");
     if (!authHeader) {
       return new Response(JSON.stringify({ error: "Unauthorized" }), {
         status: 401,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     // Verify user is super_admin
     const token = authHeader.replace("Bearer ", "");
     const { data: { user }, error: userError } = await createClient(
       supabaseUrl,
       Deno.env.get("SUPABASE_ANON_KEY")!,
       { global: { headers: { Authorization: `Bearer ${token}` } } }
     ).auth.getUser();
 
     if (userError || !user) {
       return new Response(JSON.stringify({ error: "Unauthorized" }), {
         status: 401,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     const { data: roleData } = await supabase
       .from("user_roles")
       .select("role")
       .eq("user_id", user.id)
       .single();
 
     if (!roleData || roleData.role !== "super_admin") {
       return new Response(JSON.stringify({ error: "Super admin access required" }), {
         status: 403,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     const { bookingId, transcription: rawTranscription } = await req.json();
 
     let transcription = rawTranscription;
     let callDurationSeconds: number | null = null;
 
     // Fetch transcription from booking if bookingId provided
     if (bookingId && !transcription) {
       const { data: bookingData, error: bookingError } = await supabase
         .from("booking_transcriptions")
         .select("call_transcription")
         .eq("booking_id", bookingId)
         .single();
 
       if (bookingError || !bookingData?.call_transcription) {
         return new Response(JSON.stringify({ error: "Transcription not found for booking" }), {
           status: 404,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }
 
       transcription = bookingData.call_transcription;
 
       // Get call duration from bookings table
       const { data: durationData } = await supabase
         .from("bookings")
         .select("call_duration_seconds")
         .eq("id", bookingId)
         .single();
 
       callDurationSeconds = durationData?.call_duration_seconds || null;
     }
 
     if (!transcription) {
       return new Response(JSON.stringify({ error: "No transcription provided" }), {
         status: 400,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     console.log(`Starting LLM comparison for booking ${bookingId || "manual"}`);
 
     const { system, user: userPrompt } = buildAnalysisPrompt(transcription);
 
     // Run both providers in parallel
     const [geminiResult, deepseekResult] = await Promise.all([
       callGemini(system, userPrompt).catch(err => ({
         analysis: { error: err.message },
         model: "google/gemini-2.5-flash",
         inputTokens: 0,
         outputTokens: 0,
         latencyMs: 0,
       })),
       callDeepSeek(system, userPrompt).catch(err => ({
         analysis: { error: err.message },
         model: "deepseek-chat",
         inputTokens: 0,
         outputTokens: 0,
         latencyMs: 0,
       })),
     ]);
 
     const geminiCost = calculateGeminiCost(geminiResult.inputTokens, geminiResult.outputTokens);
     const deepseekCost = calculateDeepSeekCost(deepseekResult.inputTokens, deepseekResult.outputTokens);
 
     // Store comparison result
     const { data: comparison, error: insertError } = await supabase
       .from("llm_quality_comparisons")
       .insert({
         booking_id: bookingId || null,
         transcription_text: transcription.substring(0, 50000), // Limit size
         call_duration_seconds: callDurationSeconds,
         gemini_analysis: geminiResult.analysis,
         gemini_model: geminiResult.model,
         gemini_input_tokens: geminiResult.inputTokens,
         gemini_output_tokens: geminiResult.outputTokens,
         gemini_latency_ms: geminiResult.latencyMs,
         gemini_estimated_cost: geminiCost,
         deepseek_analysis: deepseekResult.analysis,
         deepseek_model: deepseekResult.model,
         deepseek_input_tokens: deepseekResult.inputTokens,
         deepseek_output_tokens: deepseekResult.outputTokens,
         deepseek_latency_ms: deepseekResult.latencyMs,
         deepseek_estimated_cost: deepseekCost,
       })
       .select()
       .single();
 
     if (insertError) {
       console.error("Failed to store comparison:", insertError);
     }
 
     // Log costs to api_costs table
     const costEntries = [
       {
         service_provider: "lovable_ai",
         service_type: "ai_llm_comparison",
         edge_function: "compare-llm-providers",
         booking_id: bookingId || null,
         input_tokens: geminiResult.inputTokens,
         output_tokens: geminiResult.outputTokens,
         estimated_cost_usd: geminiCost,
         metadata: { model: geminiResult.model, latency_ms: geminiResult.latencyMs },
       },
       {
         service_provider: "deepseek",
         service_type: "ai_llm_comparison",
         edge_function: "compare-llm-providers",
         booking_id: bookingId || null,
         input_tokens: deepseekResult.inputTokens,
         output_tokens: deepseekResult.outputTokens,
         estimated_cost_usd: deepseekCost,
         metadata: { model: deepseekResult.model, latency_ms: deepseekResult.latencyMs },
       },
     ];
 
     await supabase.from("api_costs").insert(costEntries);
 
     console.log(`Comparison complete. Gemini: ${geminiResult.latencyMs}ms / $${geminiCost.toFixed(6)}, DeepSeek: ${deepseekResult.latencyMs}ms / $${deepseekCost.toFixed(6)}`);
 
     return new Response(
       JSON.stringify({
         success: true,
         comparisonId: comparison?.id,
         gemini: {
           analysis: geminiResult.analysis,
           model: geminiResult.model,
           inputTokens: geminiResult.inputTokens,
           outputTokens: geminiResult.outputTokens,
           latencyMs: geminiResult.latencyMs,
           estimatedCost: geminiCost,
         },
         deepseek: {
           analysis: deepseekResult.analysis,
           model: deepseekResult.model,
           inputTokens: deepseekResult.inputTokens,
           outputTokens: deepseekResult.outputTokens,
           latencyMs: deepseekResult.latencyMs,
           estimatedCost: deepseekCost,
         },
         costSavings: {
           absolute: geminiCost - deepseekCost,
           percentage: geminiCost > 0 ? ((geminiCost - deepseekCost) / geminiCost) * 100 : 0,
         },
       }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     console.error("Error in compare-llm-providers:", error);
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });