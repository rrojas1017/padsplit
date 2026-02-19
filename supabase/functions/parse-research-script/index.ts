import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'text' field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert at parsing research survey documents into structured script data for a call-center research platform.

Given the raw text of a document containing survey questions (often a move-out or member-experience script), extract and return structured data using the provided tool.

Rules for question extraction:
- Identify any opening/greeting text as intro_script. If none exists, generate a professional one using {agent_name} as a placeholder.
- Identify numbered or bulleted questions as the main questions list.
- Auto-detect question types:
  - If the question mentions "1-10", "rate", "scale", or "score" → type "scale"
  - If the question has bullet/numbered sub-options → type "multiple_choice" (extract options)
  - If the question is a yes/no question → type "yes_no"
  - Otherwise → type "open_ended"
- Generate a short ai_extraction_hint for each question (e.g., "nps_score", "transfer_reason", "payment_friction")
- SECTIONS: Group questions into named sections. Use the document's section headings if present. Assign each question a "section" field with the section name. Example sections: "Root Cause Discovery", "Transfer Exploration", "Payment Section", "Preventability Assessment", "Improvement Capture".
- PROBING FOLLOW-UPS: For each main question, extract any sub-questions or probing prompts listed under it as the "probes" array. These are additional questions the researcher can ask to dig deeper.
- CONDITIONAL BRANCHING: For yes_no questions that lead to different follow-up questions depending on the answer, populate the "branch" object:
  - yes_goto: the "order" number of the question to jump to if the member says YES
  - no_goto: the "order" number of the question to jump to if the member says NO
  - yes_probes: additional probing questions shown only when the answer is YES
  - no_probes: additional probing questions shown only when the answer is NO
- INTERNAL QUESTIONS: Mark classification or internal researcher-only questions (never read aloud) with is_internal: true. Examples: addressability category selection, preventability rating, reason code assignment.
- Assign each question a sequential "order" number starting at 1.
- Identify any closing/thank-you text as closing_script. Generate one if not found.
- Generate a professional rebuttal_script for when a caller declines.
- Infer a script name from the document title or content theme.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Parse this document into a research script with full branching and probing logic:\n\n${text}` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_research_script",
                description: "Create a structured research script from parsed document text, including sections, probing follow-ups, and conditional branching",
                parameters: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Script name inferred from document" },
                    description: { type: "string", description: "Brief description of the script purpose" },
                    intro_script: { type: "string", description: "Opening introduction text. Use {agent_name} placeholder." },
                    rebuttal_script: { type: "string", description: "Script for when caller declines" },
                    closing_script: { type: "string", description: "Closing/thank-you script" },
                    questions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          order: { type: "number", description: "Sequential order number starting at 1" },
                          question: { type: "string", description: "The main question text" },
                          type: { type: "string", enum: ["scale", "open_ended", "multiple_choice", "yes_no"] },
                          options: { type: "array", items: { type: "string" }, description: "Only for multiple_choice" },
                          required: { type: "boolean" },
                          ai_extraction_hint: { type: "string", description: "Short camelCase hint for AI extraction, e.g. transfer_reason" },
                          section: { type: "string", description: "The section name this question belongs to, e.g. 'Transfer Exploration'" },
                          is_internal: { type: "boolean", description: "True if this is a researcher-only internal classification question, not read aloud" },
                          probes: {
                            type: "array",
                            items: { type: "string" },
                            description: "Probing follow-up questions shown to the researcher under this question"
                          },
                          branch: {
                            type: "object",
                            description: "Conditional routing for yes_no questions",
                            properties: {
                              yes_goto: { type: "number", description: "Order number of question to jump to if YES" },
                              no_goto: { type: "number", description: "Order number of question to jump to if NO" },
                              yes_probes: {
                                type: "array",
                                items: { type: "string" },
                                description: "Probing prompts shown only when answer is YES"
                              },
                              no_probes: {
                                type: "array",
                                items: { type: "string" },
                                description: "Probing prompts shown only when answer is NO"
                              }
                            },
                            additionalProperties: false
                          }
                        },
                        required: ["order", "question", "type", "required", "ai_extraction_hint", "section", "is_internal"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["name", "description", "intro_script", "rebuttal_script", "closing_script", "questions"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "create_research_script" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI processing failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured output");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    // Normalize: map "question" field → "text", add "id" = order for compatibility
    const normalized = {
      ...parsed,
      questions: (parsed.questions || []).map((q: any) => ({
        id: q.order,
        order: q.order,
        text: q.question || q.text,
        type: q.type,
        required: q.required ?? false,
        options: q.options || undefined,
        ai_extraction_hint: q.ai_extraction_hint,
        section: q.section || undefined,
        is_internal: q.is_internal ?? false,
        probes: q.probes && q.probes.length > 0 ? q.probes : undefined,
        branch: q.branch && Object.keys(q.branch).length > 0 ? q.branch : undefined,
      })),
    };

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-research-script error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
