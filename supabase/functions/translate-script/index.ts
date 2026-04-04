import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { intro, closing, rebuttal, questions, targetLanguage } = await req.json();

    if (!targetLanguage || targetLanguage === "en") {
      return new Response(JSON.stringify({ intro, closing, rebuttal, questions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const languageNames: Record<string, string> = { es: "Spanish" };
    const langName = languageNames[targetLanguage] || targetLanguage;

    // Build the prompt with all translatable content
    const prompt = `Translate the following survey script content from English to ${langName}. 
Maintain a conversational, warm tone appropriate for phone surveys.
Preserve any placeholder tokens like {agent_name} exactly as-is.

Content to translate:
- Intro script: ${JSON.stringify(intro || "")}
- Closing script: ${JSON.stringify(closing || "")}
- Rebuttal script: ${JSON.stringify(rebuttal || "")}
- Questions: ${JSON.stringify((questions || []).map((q: any) => ({
  id: q.id,
  text: q.text || q.question || "",
  options: q.options || [],
  probes: q.probes || [],
  section: q.section || "",
  branch_yes_probes: q.branch?.yes_probes || [],
  branch_no_probes: q.branch?.no_probes || [],
})))}

Use the translate_script tool to return the translated content.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a professional translator specializing in conversational Spanish for phone surveys. Translate accurately while maintaining natural conversational flow." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "translate_script",
              description: "Return the translated script content",
              parameters: {
                type: "object",
                properties: {
                  intro: { type: "string", description: "Translated intro script" },
                  closing: { type: "string", description: "Translated closing script" },
                  rebuttal: { type: "string", description: "Translated rebuttal script" },
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "number" },
                        text: { type: "string", description: "Translated question text" },
                        options: { type: "array", items: { type: "string" }, description: "Translated options" },
                        probes: { type: "array", items: { type: "string" }, description: "Translated probes" },
                        section: { type: "string", description: "Translated section name" },
                        branch_yes_probes: { type: "array", items: { type: "string" } },
                        branch_no_probes: { type: "array", items: { type: "string" } },
                      },
                      required: ["id", "text"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["intro", "closing", "rebuttal", "questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "translate_script" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact your administrator." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const message = result.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.[0];
    
    let translated: any;
    if (toolCall?.function?.arguments) {
      translated = JSON.parse(toolCall.function.arguments);
    } else if (message?.content) {
      // Fallback: model returned plain text instead of tool call — try to parse JSON from it
      const contentStr = message.content.trim();
      const jsonMatch = contentStr.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, contentStr];
      try {
        translated = JSON.parse(jsonMatch[1]!.trim());
      } catch {
        console.error("Could not parse AI content as JSON:", contentStr.substring(0, 500));
        throw new Error("No translation returned from AI");
      }
    } else {
      console.error("AI response structure:", JSON.stringify(result.choices?.[0]).substring(0, 500));
      throw new Error("No translation returned from AI");
    }

    // Merge translations back into original questions structure
    const translatedQuestions = (questions || []).map((origQ: any) => {
      const tq = (translated.questions || []).find((q: any) => q.id === origQ.id);
      if (!tq) return origQ;
      return {
        ...origQ,
        text: tq.text || origQ.text,
        question: tq.text || origQ.question,
        options: tq.options?.length ? tq.options : origQ.options,
        probes: tq.probes?.length ? tq.probes : origQ.probes,
        section: tq.section || origQ.section,
        branch: origQ.branch ? {
          ...origQ.branch,
          yes_probes: tq.branch_yes_probes?.length ? tq.branch_yes_probes : origQ.branch.yes_probes,
          no_probes: tq.branch_no_probes?.length ? tq.branch_no_probes : origQ.branch.no_probes,
        } : origQ.branch,
      };
    });

    return new Response(JSON.stringify({
      intro: translated.intro || intro,
      closing: translated.closing || closing,
      rebuttal: translated.rebuttal || rebuttal,
      questions: translatedQuestions,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Translation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
