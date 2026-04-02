import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface TrendPoint {
  date: string;
  totalCases: number;
  addressablePct: string;
  hostRelatedPct: string;
  paymentRelatedPct: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { insight_id } = await req.json();

    if (!insight_id) {
      return new Response(
        JSON.stringify({ error: "insight_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch current report
    const { data: report, error: reportErr } = await supabase
      .from("research_insights")
      .select("id, data, created_at, total_records_analyzed, executive_brief")
      .eq("id", insight_id)
      .maybeSingle();

    if (reportErr || !report) {
      return new Response(
        JSON.stringify({ error: "Report not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already generated, return cached
    if (report.executive_brief) {
      return new Response(
        JSON.stringify({ executive_brief: report.executive_brief, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch last 4 historical reports for trend comparison
    const { data: historicalReports } = await supabase
      .from("research_insights")
      .select("id, data, created_at, total_records_analyzed")
      .eq("campaign_type", "move_out_survey")
      .eq("status", "completed")
      .neq("id", insight_id)
      .order("created_at", { ascending: false })
      .limit(4);

    const historicalTrends = (historicalReports || []).map((r: any) => {
      const es = r.data?.executive_summary || {};
      return {
        date: r.created_at,
        totalCases: es.total_cases || r.total_records_analyzed || 0,
        addressablePct: es.addressable_pct || "N/A",
        hostRelatedPct: es.host_related_pct || "N/A",
        paymentRelatedPct: es.payment_related_pct || "N/A",
      };
    });

    const reportData = report.data as any;
    const es = reportData?.executive_summary || {};
    const reasonCodes = reportData?.reason_code_distribution || [];
    const clusters = reportData?.issue_clusters || [];
    const topActions = reportData?.top_actions || {};
    const hostFlags = reportData?.host_accountability_flags || [];
    const paymentFriction = reportData?.payment_friction_analysis || {};
    const transferFriction = reportData?.transfer_friction_analysis || {};
    const blindSpots = reportData?.blind_spots || [];
    const emergingPatterns = reportData?.emerging_patterns || [];

    // Build the prompt
    const systemPrompt = `You are a senior research analyst at a housing company writing an executive brief for C-suite leadership. Your writing style is:

- ANALYTICAL: Don't just list numbers — explain what they MEAN for the business
- COMPARATIVE: Always compare to historical trends when data is available
- ACTIONABLE: Every insight should connect to a specific recommendation with clear ownership
- EVIDENCE-BASED: Use direct member quotes to make the data real and emotionally impactful
- CANDID: Flag what's getting worse, not just what's improving. Leadership needs truth, not spin.

Write in clear, professional prose. Use short paragraphs. Bold key numbers and findings. Structure for scannability — busy executives will skim this.

Output a JSON object with these keys:
{
  "narrative_headline": "One powerful sentence summarizing the most important finding (max 20 words)",
  "executive_narrative": "3-5 paragraphs of analytical prose covering: (1) The big picture — what's happening and why it matters, (2) What's changing — trend analysis comparing to previous reports, (3) The human impact — key member quotes that illustrate the data, (4) What must happen — prioritized recommendations with suggested owners",
  "trend_analysis": "1-2 paragraphs specifically about what's improving vs. getting worse over time",
  "risk_flags": ["Array of 2-4 short sentences about things that are getting worse or need immediate attention"],
  "key_quotes": ["Array of 3-5 impactful member quotes pulled from the report data that best illustrate the findings"],
  "recommendations_with_ownership": [
    {
      "recommendation": "Clear action item",
      "owner": "Suggested team/role (e.g., 'Property Operations', 'Member Support', 'Product Team')",
      "urgency": "P0|P1|P2",
      "rationale": "One sentence explaining why"
    }
  ],
  "generated_at": "ISO timestamp"
}`;

    const userPrompt = `Here is the complete research report data to analyze:

## Current Report (${report.created_at})
- Total cases analyzed: ${es.total_cases || report.total_records_analyzed || 0}
- Addressable cases: ${es.addressable_pct || "N/A"}
- High regret rate: ${es.high_regret_pct || "N/A"}
- Host-related issues: ${es.host_related_pct || "N/A"}
- Payment-related issues: ${es.payment_related_pct || "N/A"}

### Executive Summary
Headline: ${es.headline || "N/A"}
Key Findings: ${JSON.stringify(es.key_findings || "N/A")}
Urgent Quote: ${es.urgent_quote || "N/A"}
Top Recommendation: ${es.recommendation_summary || es.top_recommendation || "N/A"}

### Top Reason Codes (ranked by volume)
${reasonCodes.slice(0, 10).map((r: any, i: number) =>
  `${i + 1}. ${r.reason_group || r.name || "Unknown"}: ${r.count || r.value || 0} cases (${r.percentage || "?"})`
).join("\n")}

### Critical Issue Clusters
${clusters.filter((c: any) => {
  const name = (c.cluster_name || "").toUpperCase();
  return name.includes("P0") || name.includes("P1");
}).map((c: any) =>
  `- ${c.cluster_name}: ${c.description || ""}\n  Action: ${
    Array.isArray(c.recommended_action) ? c.recommended_action[0] : c.recommended_action || "None"
  }\n  Members affected: ${c.member_count || c.affected_count || "Unknown"}`
).join("\n\n")}

### Host Accountability Flags
${hostFlags.slice(0, 5).map((f: any) =>
  `- [${f.severity || "Unknown"}] ${f.flag || f.description || ""} (${f.member_count || f.affected_count || "?"} members)`
).join("\n")}

### Payment Friction
${typeof paymentFriction === "string" ? paymentFriction : JSON.stringify(paymentFriction.key_friction_points || paymentFriction, null, 2).substring(0, 500)}

### Blind Spots & Emerging Patterns
Blind spots: ${JSON.stringify(blindSpots).substring(0, 300)}
Emerging patterns: ${JSON.stringify(emergingPatterns).substring(0, 300)}

### Priority Actions
${(() => {
  const actions: any[] = [];
  if (topActions.p0_immediate_risk_mitigation) actions.push(...topActions.p0_immediate_risk_mitigation.map((a: any) => ({ ...a, tier: "P0" })));
  if (topActions.p1_systemic_process_redesign) actions.push(...topActions.p1_systemic_process_redesign.map((a: any) => ({ ...a, tier: "P1" })));
  if (Array.isArray(topActions)) actions.push(...topActions.slice(0, 10));
  return actions.slice(0, 8).map((a: any) =>
    `- [${a.tier || a.priority || "?"}] ${a.action || a.title || a.description || ""} ${a.quick_win ? "(Quick Win)" : ""}`
  ).join("\n");
})()}

## Historical Trend Data (last ${historicalTrends.length} reports)
${historicalTrends.length > 0 ? historicalTrends.map((t: TrendPoint) =>
  `- ${t.date}: ${t.totalCases} cases | Addressable: ${t.addressablePct} | Host: ${t.hostRelatedPct} | Payment: ${t.paymentRelatedPct}`
).join("\n") : "No historical data available for trend comparison."}

Write the executive brief JSON now. Be specific with numbers. Compare trends. Use actual quotes from the data. Flag what's getting worse.`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.lovable.dev/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", errText);
      return new Response(
        JSON.stringify({ error: "AI generation failed", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "{}";
    
    let briefData: any;
    try {
      briefData = JSON.parse(rawContent);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        briefData = JSON.parse(jsonMatch[1]);
      } else {
        briefData = { executive_narrative: rawContent, generated_at: new Date().toISOString() };
      }
    }

    // Ensure generated_at
    if (!briefData.generated_at) {
      briefData.generated_at = new Date().toISOString();
    }

    // Cache in database
    const { error: updateErr } = await supabase
      .from("research_insights")
      .update({ executive_brief: briefData })
      .eq("id", insight_id);

    if (updateErr) {
      console.error("Failed to cache brief:", updateErr);
    }

    return new Response(
      JSON.stringify({ executive_brief: briefData, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error generating executive brief:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
