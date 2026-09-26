// Per-script survey Executive Brief — AI narrative generator (CR-010 Phase 3).
// Twin of `generate-pe-executive-brief`: same auth, models, timeouts, JSON
// shape and cost logging, with a generic, section-driven prompt.
// Stateless: aggregates are passed in the request body. Bodies are never logged.

import { corsHeaders, requireUser, MANAGERS, adminClient } from "../_shared/auth.ts";
import { tokensFromUsage, logApiCost } from "../_shared/costs.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const MAX_STR = 500;
const MAX_QUESTIONS = 60;
const MAX_KPIS = 12;
const MAX_SECTIONS = 30;
const MAX_ROWS = 10;

type Row = { label: string; count: number; pct: number };

interface CleanQuestion {
  order: number;
  text: string;
  section: string;
  type: string;
  count: number;
  avg: number | null;
  topAnswers: Row[];
  clusters: Row[];
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const str = (v: unknown, max = MAX_STR): string => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const int = (v: unknown): number => {
  const n = num(v);
  return n == null ? 0 : Math.max(0, Math.round(n));
};
const rows = (v: unknown): Row[] =>
  Array.isArray(v)
    ? v.slice(0, MAX_ROWS).map((r: any) => ({ label: str(r?.label, 200), count: int(r?.count), pct: num(r?.pct) ?? 0 }))
    : [];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireUser(req, MANAGERS);
  if (!auth.ok) return auth.response;
  const costUserId = auth.ctx.userId;
  const costIsInternal = auth.ctx.role === 'super_admin';

  try {
    if (!LOVABLE_API_KEY) return json(500, { error: "Missing LOVABLE_API_KEY" });

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "invalid JSON body" });
    }
    if (!body || typeof body !== "object") return json(400, { error: "body required" });
    if (!Array.isArray(body.perQuestion)) return json(400, { error: "perQuestion must be an array" });
    if (body.perQuestion.length > MAX_QUESTIONS) return json(400, { error: `perQuestion max ${MAX_QUESTIONS}` });
    if (body.kpis != null && (!Array.isArray(body.kpis) || body.kpis.length > MAX_KPIS)) {
      return json(400, { error: `kpis must be an array (max ${MAX_KPIS})` });
    }
    if (body.sections != null && (!Array.isArray(body.sections) || body.sections.length > MAX_SECTIONS)) {
      return json(400, { error: `sections must be an array (max ${MAX_SECTIONS})` });
    }

    const surveyName = str(body.surveyName) || "Member Survey";
    const surveyPurpose = str(body.surveyPurpose);
    const kpis = (body.kpis || []).map((k: any) => ({ label: str(k?.label, 100), value: str(k?.value, 50) }));
    const sections: string[] = (body.sections || []).map((s: unknown) => str(s, 200)).filter(Boolean);
    const perQuestion: CleanQuestion[] = body.perQuestion.map((q: any) => ({
      order: int(q?.order),
      text: str(q?.text),
      section: str(q?.section, 200),
      type: str(q?.type, 30),
      count: int(q?.count),
      avg: num(q?.avg),
      topAnswers: rows(q?.topAnswers),
      clusters: rows(q?.clusters),
    }));
    const totalRoutedCalls = int(body.totalRoutedCalls);
    const validConversations = int(body.validConversations);
    const totalRespondents = int(body.totalRespondents);
    const dateStart = str(body.dateRange?.start, 20);
    const dateEnd = str(body.dateRange?.end, 20);

    const systemPrompt = `You are a senior research analyst writing an executive brief on a member survey for a housing company's C-suite. Style:

- ANALYTICAL: explain what the numbers MEAN for the business, not just what they are.
- AGGREGATE-ONLY: never quote individual members. Refer to "members", "respondents", "segments".
- CANDID: flag what's getting worse or risky, not just wins.
- ACTIONABLE: every insight ties to a recommendation with a suggested owner (e.g. "Member Support", "Product", "Property Ops", "Sales", "Marketing").

Return JSON ONLY with this shape:
{
  "narrative_headline": "One sentence (max 20 words) summarizing the most important finding",
  "executive_narrative": "3-5 paragraphs of analytical prose separated by blank lines. Structure the paragraphs around the survey's own sections (listed in the user message): overall picture first, then the most important section-level findings, then what must happen next.",
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

    const userPrompt = `## Survey
Name: ${surveyName}
${surveyPurpose ? `Purpose: ${surveyPurpose}\n` : ""}Period: ${dateStart || "?"} to ${dateEnd || "?"}
Routed calls: ${totalRoutedCalls} · Valid conversations: ${validConversations} · Respondents with answers: ${totalRespondents}

## Headline KPIs
${kpis.length === 0 ? "(none)" : kpis.map((k: { label: string; value: string }) => `- ${k.label}: ${k.value}`).join("\n")}

## Sections (in script order)
${sections.length === 0 ? "(none)" : sections.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Per-Question Summary
${perQuestion.map((q) => {
  const header = `Q${q.order} [${q.type}]${q.section ? ` {${q.section}}` : ""} ${q.text} — n=${q.count}` + (q.avg != null ? ` · avg=${q.avg.toFixed(2)}` : "");
  const tops = q.topAnswers.length
    ? "\n   " + q.topAnswers.slice(0, 4).map((a) => `${a.label} (${a.count}, ${a.pct.toFixed(1)}%)`).join(" · ")
    : "";
  const clusters = q.clusters.length
    ? "\n   clusters: " + q.clusters.slice(0, 5).map((c) => `${c.label} (${c.count}, ${c.pct.toFixed(1)}%)`).join(" · ")
    : "";
  return header + tops + clusters;
}).join("\n")}

Write the JSON now. Be specific. Recommendations must reference real numbers from above.`;

    async function callModel(model: string, timeoutMs: number): Promise<{ ok: true; brief: any } | { ok: false; reason: string; status?: number }> {
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
            temperature: 0.6,
          }),
          signal: ctrl.signal,
        });
        if (!aiResponse.ok) {
          // Status only — never log provider bodies (may echo the prompt).
          console.error(`[generate-script-survey-brief] ${model} error status:`, aiResponse.status);
          await aiResponse.text().catch(() => "");
          return { ok: false, reason: `http_${aiResponse.status}`, status: aiResponse.status };
        }
        const aiResult = await aiResponse.json();
        const rawContent = aiResult?.choices?.[0]?.message?.content || "{}";
        {
          const tk = tokensFromUsage(aiResult, systemPrompt + userPrompt, rawContent);
          await logApiCost(adminClient(), {
            service_provider: 'lovable_ai', service_type: 'script_survey_executive_brief', edge_function: 'generate-script-survey-brief',
            input_tokens: tk.inputTokens, output_tokens: tk.outputTokens, token_source: tk.source,
            model: model, triggered_by_user_id: costUserId, is_internal: costIsInternal,
          });
        }
        let brief: any;
        try {
          brief = JSON.parse(rawContent);
        } catch {
          const m = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
          try {
            brief = m ? JSON.parse(m[1]) : { executive_narrative: rawContent };
          } catch {
            brief = { executive_narrative: rawContent };
          }
        }
        if (!brief || (!brief.executive_narrative && !brief.narrative_headline)) {
          return { ok: false, reason: "empty_brief" };
        }
        if (!brief.generated_at) brief.generated_at = new Date().toISOString();
        return { ok: true, brief };
      } catch (e: any) {
        const reason = e?.name === "AbortError" ? "timeout" : String(e?.message || e);
        console.error(`[generate-script-survey-brief] ${model} failed:`, reason);
        return { ok: false, reason };
      } finally {
        clearTimeout(t);
      }
    }

    let modelUsed = "google/gemini-2.5-pro";
    let result = await callModel("google/gemini-2.5-pro", 110_000);
    if (!result.ok) {
      console.warn("[generate-script-survey-brief] Pro failed, falling back to Flash:", result.reason);
      modelUsed = "google/gemini-2.5-flash";
      result = await callModel("google/gemini-2.5-flash", 30_000);
    }
    if (!result.ok) return json(502, { error: "AI generation failed", detail: result.reason });
    return json(200, { executive_brief: result.brief, model_used: modelUsed });
  } catch (err) {
    console.error("[generate-script-survey-brief] Error:", String((err as any)?.message || err));
    return json(500, { error: "Internal error" });
  }
});
