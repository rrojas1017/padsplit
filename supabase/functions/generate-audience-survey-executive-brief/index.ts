// Audience Survey Executive Brief — AI narrative generator

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface QuestionSummary {
  number: number;
  label: string;
  type: "multi" | "yesno";
  total: number;
  topAnswers?: Array<{ label: string; count: number; pct: number }>;
  boolData?: { yes: number; no: number; total: number; pct: number };
}

interface RequestBody {
  meta: { totalRecords: number; avgAnswered: number; completionRate: number };
  questions: QuestionSummary[];
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
    const { meta, questions } = body || ({} as RequestBody);
    if (!meta || !Array.isArray(questions)) {
      return new Response(JSON.stringify({ error: "meta and questions required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a senior marketing research analyst writing an Audience Survey executive brief for PadSplit leadership.

Style requirements:
- ANALYTICAL: explain what the patterns mean for acquisition, awareness, trust, and content strategy.
- AGGREGATE-ONLY: never quote or imply individual respondents.
- CANDID: identify gaps, risks, and missed opportunities.
- ACTIONABLE: every recommendation should name the business action and owner.

Return JSON ONLY with this shape:
{
  "narrative_headline": "One sentence, max 20 words",
  "executive_analysis": "3-5 paragraphs of executive analysis connecting the survey results to marketing strategy.",
  "strategic_findings": ["4-6 specific analytical findings"],
  "recommended_actions": [
    { "recommendation": "Specific action", "owner": "Team/role", "priority": "P0|P1|P2", "rationale": "One sentence using the survey evidence" }
  ],
  "question_analysis": [
    { "number": 1, "interpretation": "1-2 sentence interpretation of what this question's result means" }
  ],
  "generated_at": "ISO timestamp"
}

Hard rules:
- Do not invent numbers. Only use the figures provided.
- Do not include member quotes or verbatims.
- Keep output strictly valid JSON.`;

    const userPrompt = `## Audience Survey Overview
Responses: ${meta.totalRecords}
Average questions answered: ${meta.avgAnswered}/13
Completion rate: ${meta.completionRate}%

## Per-question Results
${questions.map((q) => {
  const header = `Q${q.number} [${q.type}] ${q.label} — n=${q.total}`;
  if (q.type === "yesno" && q.boolData) {
    return `${header}\n   Yes: ${q.boolData.yes} (${q.boolData.pct}%) · No: ${q.boolData.no} (${q.boolData.total > 0 ? 100 - q.boolData.pct : 0}%)`;
  }
  const tops = q.topAnswers && q.topAnswers.length
    ? q.topAnswers.slice(0, 6).map((a) => `${a.label}: ${a.count} (${a.pct}%)`).join(" · ")
    : "No aggregated answers";
  return `${header}\n   ${tops}`;
}).join("\n")}

Write the JSON now. Make the analysis specific to these results and avoid generic marketing advice.`;

    async function callModel(model: string, timeoutMs: number): Promise<{ ok: true; brief: any } | { ok: false; reason: string }> {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.55,
          }),
          signal: ctrl.signal,
        });
        if (!aiResponse.ok) return { ok: false, reason: await aiResponse.text() };
        const aiResult = await aiResponse.json();
        const rawContent = aiResult?.choices?.[0]?.message?.content || "{}";
        let brief: any;
        try {
          brief = JSON.parse(rawContent);
        } catch {
          const m = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
          brief = m ? JSON.parse(m[1]) : { executive_analysis: rawContent };
        }
        if (!brief.generated_at) brief.generated_at = new Date().toISOString();
        return { ok: true, brief };
      } catch (e: any) {
        return { ok: false, reason: e?.name === "AbortError" ? "timeout" : String(e?.message || e) };
      } finally {
        clearTimeout(t);
      }
    }

    let modelUsed = "google/gemini-2.5-pro";
    let result = await callModel("google/gemini-2.5-pro", 100_000);
    if (!result.ok) {
      console.warn("[generate-audience-survey-executive-brief] Pro failed, falling back:", result.reason);
      modelUsed = "google/gemini-2.5-flash";
      result = await callModel("google/gemini-2.5-flash", 30_000);
    }

    if (!result.ok) {
      return new Response(JSON.stringify({ error: "AI generation failed", detail: result.reason }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ executive_brief: result.brief, model_used: modelUsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-audience-survey-executive-brief] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});