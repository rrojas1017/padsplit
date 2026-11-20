// CR-021: fill the "Other" detail from the transcript. Never log transcript text or answers.
import { tokensFromUsage } from "./costs.ts";

export interface OtherItem { question_id: string; question_text: string; options: string[]; selected: string[] }
export interface OtherResult { question_id: string; other_text: string | null }

const isOther = (s: unknown) => typeof s === "string" && s.trim().toLowerCase() === "other";

/** Pure: questions where "Other" is selected, no detail exists, and the question has a literal "Other" option. */
// deno-lint-ignore no-explicit-any
export function findOtherQuestions(raw: any, questions: any[]): OtherItem[] {
  if (!raw || typeof raw !== "object" || !Array.isArray(questions)) return [];
  const entries: [string, any][] = Array.isArray(raw)
    ? raw.map((e: any) => [e?.question_id, e])
    : Object.entries(raw);
  const out: OtherItem[] = [];
  for (const [key, e] of entries) {
    if (!e || typeof e !== "object") continue;
    const qid = e.question_id || key;
    const sel: string[] = Array.isArray(e.selected_option_labels) ? e.selected_option_labels.filter((x: unknown) => typeof x === "string") : [];
    if (!sel.some(isOther)) continue;
    if (typeof e.other_text === "string" && e.other_text.trim()) continue;
    const q = questions.find((x) => x?.id === qid);
    const options: string[] = Array.isArray(q?.options) ? q.options : [];
    if (!options.some(isOther)) continue;
    out.push({ question_id: qid, question_text: q?.question || q?.text || e.question_text || "", options, selected: sel });
  }
  return out;
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /(\+?\d[\d\s().-]{6,}\d)/g;

export function cleanOtherText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(EMAIL, "").replace(PHONE, "").replace(/\s+/g, " ").trim().slice(0, 200).trim();
  return t && t.toLowerCase() !== "null" ? t : null;
}

const SYSTEM = `You read a phone-call transcript between an agent and a caller. For each question listed, the caller's answer was recorded as "Other". Return what the CALLER said in answer to that question.
Rules:
- Quote the caller as close to verbatim as possible, at most 200 characters, in the transcript's language.
- No interpretation, no summary of the agent's words, no agent words.
- Never include names, phone numbers, emails or addresses; leave them out.
- If the transcript has no clear caller answer to that question, use null.
Respond with JSON only: {"answers":[{"question_id":"...","other_text":"..." or null}]}`;

export async function extractOtherDetails(p: { apiKey: string; model: string; transcript: string; items: OtherItem[] }):
  Promise<{ results: OtherResult[]; inputTokens: number; outputTokens: number }> {
  const qs = p.items.map((i) => ({ question_id: i.question_id, question: i.question_text, options: i.options, selected: i.selected }));
  const user = `Questions:\n${JSON.stringify(qs)}\n\nTranscript:\n${p.transcript}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${p.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: p.model, temperature: 0, response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }] }),
  });
  if (!res.ok) { await res.text(); throw new Error(`gateway_${res.status}`); }
  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? "";
  const tk = tokensFromUsage(json, SYSTEM + user, content);
  let parsed: any = null;
  try { const m = content.match(/```(?:json)?\s*([\s\S]*?)```/); parsed = JSON.parse(m ? m[1] : content); } catch { parsed = null; }
  const arr: any[] = Array.isArray(parsed?.answers) ? parsed.answers : [];
  const results = p.items.map((i) => ({ question_id: i.question_id, other_text: cleanOtherText(arr.find((a) => a?.question_id === i.question_id)?.other_text) }));
  return { results, inputTokens: tk.inputTokens, outputTokens: tk.outputTokens };
}
