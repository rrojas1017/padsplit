// CR-021 Phase A: dry run only. Reads data, returns proposals; writes nothing.
import { requireUser, ADMINS, adminClient, corsHeaders, jsonResponse } from "../_shared/auth.ts";
import { llmCost } from "../_shared/costs.ts";
import { findOtherQuestions, extractOtherDetails } from "../_shared/otherDetail.ts";

const SCRIPTS = ["247ead24-6b86-4b19-b352-0493c1831ba9", "827b23ef-3f35-4108-8462-468bf6cf7872"];
const UUID = /^[0-9a-f-]{36}$/i;
const normModel = (m: string | null) => !m ? "google/gemini-2.5-flash" : m.includes("/") ? m : `google/${m}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireUser(req, ADMINS);
  if (!auth.ok) return auth.response;
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  if (body.dry_run === false) return jsonResponse(400, { error: "not enabled in Phase A" });
  const ids: string[] = Array.isArray(body.booking_ids) ? body.booking_ids.filter((x: unknown) => typeof x === "string" && UUID.test(x)) : [];
  if (!ids.length || ids.length > 20) return jsonResponse(400, { error: "booking_ids: 1-20 uuids required" });
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return jsonResponse(500, { error: "missing_key" });
  const admin = adminClient();

  const { data: scripts, error: sErr } = await admin.from("research_scripts").select("id, questions, ai_model").in("id", SCRIPTS);
  if (sErr) return jsonResponse(500, { error: sErr.code });
  const { data: bookings, error: bErr } = await admin.from("bookings")
    .select("id, has_valid_conversation, research_call_id, research_calls!bookings_research_call_id_fkey(campaign_id, research_campaigns(script_id))")
    .in("id", ids);
  if (bErr) return jsonResponse(500, { error: bErr.code });
  const { data: trs, error: tErr } = await admin.from("booking_transcriptions")
    .select("booking_id, call_transcription, research_extraction").in("booking_id", ids);
  if (tErr) return jsonResponse(500, { error: tErr.code });

  let inTok = 0, outTok = 0, cost = 0;
  const out: any[] = [];
  for (const id of ids) {
    const b: any = (bookings ?? []).find((x: any) => x.id === id);
    const scriptId = b?.research_calls?.research_campaigns?.script_id;
    const script: any = (scripts ?? []).find((s: any) => s.id === scriptId);
    const tr: any = (trs ?? []).find((t: any) => t.booking_id === id);
    const skip = (reason: string) => out.push({ booking_id: id, skipped: reason });
    if (!b?.has_valid_conversation) { skip("not_valid"); continue; }
    if (!script) { skip("script_not_in_scope"); continue; }
    if (!tr?.call_transcription || tr.call_transcription.length <= 200) { skip("no_transcript"); continue; }
    const items = findOtherQuestions(tr.research_extraction?.raw_script_answers, script.questions);
    if (!items.length) { skip("no_other"); continue; }
    const model = normModel(script.ai_model);
    try {
      const r = await extractOtherDetails({ apiKey, model, transcript: tr.call_transcription, items });
      inTok += r.inputTokens; outTok += r.outputTokens; cost += llmCost(model, r.inputTokens, r.outputTokens);
      out.push({ booking_id: id, model, answers: r.results.map((x) => ({ ...x, question_text: items.find((i) => i.question_id === x.question_id)?.question_text })) });
    } catch (e) { skip(e instanceof Error ? e.message : "error"); }
  }
  console.log(`[fill-other-details] dry_run bookings=${ids.length} answered=${out.filter((o) => o.answers).length} in=${inTok} out=${outTok}`);
  return jsonResponse(200, { dry_run: true, results: out, input_tokens: inTok, output_tokens: outTok, cost_usd: Number(cost.toFixed(6)) });
});
