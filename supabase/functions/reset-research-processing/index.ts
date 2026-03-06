import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch (_) { /* empty body is fine */ }
    
    const dryRun = body.dryRun === true;

    if (dryRun) {
      const { count, error } = await supabase
        .from("booking_transcriptions")
        .select("id", { count: "exact", head: true })
        .eq("research_processing_status", "completed");

      if (error) throw new Error(JSON.stringify(error));

      return new Response(JSON.stringify({ count: count || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get IDs of completed research transcriptions
    const { data: toReset, error: listError } = await supabase
      .from("booking_transcriptions")
      .select("id")
      .eq("research_processing_status", "completed");

    if (listError) throw new Error(JSON.stringify(listError));

    const ids = (toReset || []).map((r: { id: string }) => r.id);

    if (ids.length === 0) {
      return new Response(JSON.stringify({ reset_count: 0, message: "No records to reset" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resetCount = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error: updateError } = await supabase
        .from("booking_transcriptions")
        .update({
          research_processing_status: null,
          research_extraction: null,
          research_classification: null,
          research_processed_at: null,
          research_human_review: false,
        })
        .in("id", chunk);

      if (updateError) throw new Error(JSON.stringify(updateError));
      resetCount += chunk.length;
    }

    // Trigger batch processing
    await fetch(`${supabaseUrl}/functions/v1/batch-process-research-records`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    return new Response(JSON.stringify({
      reset_count: resetCount,
      message: `Reset ${resetCount} records. Batch processing started.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("reset-research-processing error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
