// Payment Experience Executive Brief — AI narrative generator
// Mirrors `generate-executive-brief` (Move-Out), but:
//  - Tuned for Payment Experience aggregates (KPIs, per-question, friction, autopay)
//  - Uses Gemini 2.5 Pro for executive prose
//  - Stateless: aggregates are passed in the request body (no DB snapshot)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface AggregatedKpis {
  membersSurveyed: number;
  literacyAvg: number | null;          // 0..100
  autopayEnrolledPct: number | null;   // 0..100
  moveInClarityAvg: number | null;     // 0..5
  hardshipAwarePct: number | null;     // 0..100
  payCycleMisalignmentPct: number | null; // 0..100
}

interface AggregatedQuestion {
  order: number;
  text: string;
  type: string;
  count: number;
  avg?: number | null;
  topAnswers?: Array<{ label: string; count: number; pct: number }>;
  // For open-ended: top clusters (label + share), counts only — no verbatims.
  clusters?: Array<{ label: string; count: number; pct: number }>;
}

interface RequestBody {
  kpis: AggregatedKpis;
  perQuestion: AggregatedQuestion[];
  frictionThemes: Array<{ label: string; count: number; pct: number }>;
  autopayBarriers: Array<{ label: string; count: number; pct: number }>;
  dateRange?: { start?: string | null; end?: string | null };
  totalRespondents: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    const { kpis, perQuestion, frictionThemes, autopayBarriers, totalRespondents } = body || ({} as RequestBody);

    if (!kpis || !Array.isArray(perQuestion)) {
      return new Response(JSON.stringify({ error: "kpis and perQuestion required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fmtPct = (v: number | null | undefined) =>
      v == null ? "N/A" : `${Math.round(v)}%`;
    const fmtScore = (v: number | null | undefined, max: number) =>
      v == null ? "N/A" : `${v.toFixed(1)}/${max}`;

    const systemPrompt = `You are a senior research analyst writing a Payment Experience executive brief for a housing company's C-suite. Style:

- ANALYTICAL: explain what the numbers MEAN for the business, not just what they are.
- AGGREGATE-ONLY: never quote individual members. Refer to "members", "respondents", "segments".
- CANDID: flag what's getting worse or risky, not just wins.
- ACTIONABLE: every insight ties to a recommendation with a suggested owner (e.g. "Member Support", "Product", "Property Ops", "Billing").

Return JSON ONLY with this shape:
{
  "narrative_headline": "One sentence (max 20 words) summarizing the most important finding",
  "executive_narrative": "3-5 paragraphs of analytical prose covering: (1) overall payment health, (2) auto-pay enrollment dynamics and barriers, (3) friction themes and clarity gaps, (4) hardship awareness + pay-cycle misalignment, (5) what must happen next.",
  "risk_flags": ["2-4 short sentences about urgent risks or worsening signals"],
  "recommended_actions": [
    { "recommendation": "Clear action", "owner": "Team/role", "urgency": "P0|P1|P2", "rationale": "One sentence" }
  ],
  "generated_at": "ISO timestamp"
}

Hard rules:
- Do not invent numbers. Only use figures provided in the user message.
- Do not include member quotes or verbatims.
- Keep the output strictly valid JSON.`;

    const userPrompt = `## Payment Experience Aggregates

Respondents: ${totalRespondents}
Avg Payment Literacy: ${fmtScore(kpis.literacyAvg, 100)}
Auto-pay Enrolled: ${fmtPct(kpis.autopayEnrolledPct)}
Move-in Cost Clarity: ${fmtScore(kpis.moveInClarityAvg, 5)}
Hardship-Aware: ${fmtPct(kpis.hardshipAwarePct)}
Pay-cycle Misalignment: ${fmtPct(kpis.payCycleMisalignmentPct)}

## Top Friction Themes
${frictionThemes.length === 0 ? "(none)" : frictionThemes.map((t, i) => `${i + 1}. ${t.label}: ${t.count} (${t.pct.toFixed(1)}%)`).join("\n")}

## Auto-pay Barriers (among not-enrolled)
${autopayBarriers.length === 0 ? "(none)" : autopayBarriers.map((b, i) => `${i + 1}. ${b.label}: ${b.count} (${b.pct.toFixed(1)}%)`).join("\n")}

## Per-Question Summary (all script questions)
${perQuestion.map((q) => {
  const header = `Q${q.order} [${q.type}] ${q.text} — n=${q.count}` + (q.avg != null ? ` · avg=${q.avg.toFixed(2)}` : "");
  const tops = q.topAnswers && q.topAnswers.length
    ? "\n   " + q.topAnswers.slice(0, 5).map((a) => `${a.label} (${a.count}, ${a.pct.toFixed(1)}%)`).join(" · ")
    : "";
  const clusters = q.clusters && q.clusters.length
    ? "\n   clusters: " + q.clusters.slice(0, 6).map((c) => `${c.label} (${c.count}, ${c.pct.toFixed(1)}%)`).join(" · ")
    : "";
  return header + tops + clusters;
}).join("\n")}

Write the JSON now. Be specific. Recommendations must reference real numbers from above.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[generate-pe-executive-brief] AI error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "AI generation failed", status: aiResponse.status, detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult?.choices?.[0]?.message?.content || "{}";

    let brief: any;
    try {
      brief = JSON.parse(rawContent);
    } catch {
      const m = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      brief = m ? JSON.parse(m[1]) : { executive_narrative: rawContent };
    }
    if (!brief.generated_at) brief.generated_at = new Date().toISOString();

    return new Response(JSON.stringify({ executive_brief: brief }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-pe-executive-brief] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
