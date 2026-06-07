// AI-powered clustering for Payment Experience open-ended responses.
// - Requires an authenticated caller with research-access role.
// - Persistently caches results in payment_experience_open_ended_cluster_cache.
// - Calls Gemini via the Lovable AI Gateway only on cache miss.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "google/gemini-2.5-flash";
const MAX_RESPONSES = 5000;
const MAX_RESPONSE_LEN = 1000;
const MAX_UNIQUES_TO_AI = 600;
const ALLOWED_ROLES = new Set([
  "super_admin",
  "admin",
  "supervisor",
  "researcher",
]);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---- Deterministic fallback classifier (kept in sync with the client util) ----
const NO_ISSUE_EXACT = new Set([
  "no", "none", "nothing", "n/a", "na", "all good", "fine", "good", "nope",
  "no issues", "no issue", "nothing really", "no, nothing", "all is well",
  "everything is fine", "everything good", "everything is good", "no complaints",
  "not really", "not at all", "nothing comes to mind", "i don't know",
  "i dont know", "idk", "unsure",
]);
type FallbackRule = { id: string; label: string; keywords?: string[]; exact?: Set<string> };
const FALLBACK_RULES: FallbackRule[] = [
  { id: "no_issue", label: "No issue reported", exact: NO_ISSUE_EXACT },
  { id: "late_fees", label: "Late fees & penalties", keywords: ["late fee", "late charge", "penalty", "penalt"] },
  { id: "payment_reminders", label: "Payment reminders & notifications", keywords: ["remind", "notification", "notif", "alert", "text me", "email me", "warning", "heads up", "before due", "advance notice"] },
  { id: "due_date_flex", label: "Due-date flexibility", keywords: ["due date", "extension", "more time", "grace", "flexible", "weekly", "biweekly", "bi-weekly", "monthly", "push back", "later date", "earlier date", "change date", "different date"] },
  { id: "autopay", label: "Autopay", keywords: ["autopay", "auto pay", "auto-pay", "automatic"] },
  { id: "payment_methods", label: "Payment method requests", keywords: ["cash app", "cashapp", "venmo", "zelle", "paypal", "apple pay", "google pay", "debit", "credit", "bank", "ach", "money order", "check", "transfer", "wire", "crypto"] },
  { id: "payment_processing", label: "Payment processing issues", keywords: ["process", "post", "posted", "pending", "didn't go through", "didnt go through", "declined", "fail", "error", "glitch", "bug"] },
  { id: "partial_payments", label: "Partial / split payments", keywords: ["partial", "split", "break it up", "pay half", "smaller payment", "installment"] },
  { id: "refunds", label: "Refunds", keywords: ["refund", "reimburs", "credit back", "money back"] },
  { id: "receipt_history", label: "Receipts & payment history", keywords: ["receipt", "history", "statement", "record", "proof", "confirmation"] },
  { id: "fees_charges", label: "Fees or unexpected charges", keywords: ["fee", "charge", "surcharge", "hidden", "extra cost"] },
  { id: "lower_price", label: "Lower price / affordability", keywords: ["cheaper", "lower", "too expensive", "too high", "afford", "price", "rate", "cost too much"] },
  { id: "hardship", label: "Hardship assistance", keywords: ["hardship", "lost job", "unemploy", "medical", "emergency", "help", "assist", "covid", "sick", "injury", "laid off", "fired", "behind"] },
  { id: "app_confusion", label: "App or website confusion", keywords: ["app", "website", "portal", "dashboard", "confus", "navigat", "login", "log in", "sign in", "interface", "buttons", "menu", "slow", "lag", "crash"] },
  { id: "clarity_communication", label: "Clarity & communication", keywords: ["clear", "clarity", "explain", "explanation", "instructions", "communicate", "communication", "transparent"] },
  { id: "customer_support", label: "Customer support", keywords: ["support", "customer service", "rep", "agent", "chat", "phone call", "call back", "callback", "answer the phone"] },
  { id: "host_support", label: "Host support", keywords: ["host", "landlord", "owner"] },
  { id: "positive_feedback", label: "Positive feedback", keywords: ["easy", "simple", "great", "love", "perfect", "smooth", "no problem", "satisfied", "happy", "convenient"] },
];

function fallbackClassify(text: string): { id: string; label: string } {
  const lower = text.toLowerCase().trim();
  for (const r of FALLBACK_RULES) {
    if (r.exact && r.exact.has(lower)) return { id: r.id, label: r.label };
  }
  for (const r of FALLBACK_RULES) {
    if (r.keywords && r.keywords.some((kw) => lower.includes(kw))) {
      return { id: r.id, label: r.label };
    }
  }
  return { id: "other", label: "Other responses" };
}

function tolerantJsonParse(text: string): any | null {
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* fall through */ }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch { /* fall through */ }
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { /* ignore */ }
  }
  return null;
}

function slugifyId(label: string, idx: number): string {
  const s = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return s ? s.slice(0, 48) : `cluster-${idx + 1}`;
}

interface AICluster {
  id: string;
  label: string;
  summary?: string;
  responseIndices: number[];
}

async function callGemini(
  questionText: string,
  uniques: { text: string; count: number }[],
): Promise<{ ok: true; clusters: AICluster[] } | { ok: false; reason: string }> {
  const numbered = uniques
    .map((u, i) => `${i + 1}. (x${u.count}) ${u.text}`)
    .join("\n");

  const system = `You are an expert qualitative researcher clustering open-ended survey responses for a dashboard.

Rules:
- Create as many specific, dashboard-friendly clusters as needed to minimize the "Other" bucket.
- Cluster labels must be short (2-6 words), distinct, and non-overlapping.
- Every numbered response MUST be assigned to exactly one cluster (or "otherIndices" if truly unclassifiable).
- "Other" is reserved for genuinely unclassifiable answers only.
- Return STRICT JSON only — no preamble, no markdown.

Output JSON shape:
{
  "clusters": [
    { "id": "short-kebab-id", "label": "Short cluster label", "summary": "One-sentence summary.", "memberIndices": [1,2,3] }
  ],
  "otherIndices": [7, 12]
}`;

  const user = `Survey question:
"${questionText}"

Numbered unique responses (x{count} = duplicate frequency, treat each numbered item as one response when assigning indices):
${numbered}

Cluster them per the rules. Output only the JSON.`;

  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
  } catch (e) {
    console.error("[cluster-pe] gemini fetch failed", e);
    return { ok: false, reason: "ai_error" };
  }
  if (res.status === 429) return { ok: false, reason: "rate_limited" };
  if (res.status === 402) return { ok: false, reason: "payment_required" };
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[cluster-pe] gemini http", res.status, body.slice(0, 500));
    return { ok: false, reason: "ai_error" };
  }
  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  const parsed = typeof content === "string" ? tolerantJsonParse(content) : content;
  if (!parsed || !Array.isArray(parsed.clusters)) {
    return { ok: false, reason: "invalid_json" };
  }

  const N = uniques.length;
  const seen = new Set<number>();
  const aiClusters: AICluster[] = [];

  for (let i = 0; i < parsed.clusters.length; i++) {
    const c = parsed.clusters[i];
    const label = String(c?.label ?? "").trim() || `Cluster ${i + 1}`;
    const id = (typeof c?.id === "string" && c.id.trim()) || slugifyId(label, i);
    const summary = typeof c?.summary === "string" ? c.summary.trim() : undefined;
    const members: number[] = [];
    const raw = Array.isArray(c?.memberIndices) ? c.memberIndices : [];
    for (const v of raw) {
      const idx = Number(v);
      if (!Number.isInteger(idx) || idx < 1 || idx > N) continue;
      if (seen.has(idx)) continue;
      seen.add(idx);
      members.push(idx);
    }
    if (members.length > 0 && id !== "other") {
      aiClusters.push({ id, label, summary, responseIndices: members });
    }
  }

  // Other: explicit + any unseen indices.
  const otherSet = new Set<number>();
  const rawOther = Array.isArray(parsed.otherIndices) ? parsed.otherIndices : [];
  for (const v of rawOther) {
    const idx = Number(v);
    if (Number.isInteger(idx) && idx >= 1 && idx <= N && !seen.has(idx)) {
      seen.add(idx);
      otherSet.add(idx);
    }
  }
  for (let i = 1; i <= N; i++) {
    if (!seen.has(i)) otherSet.add(i);
  }
  if (otherSet.size > 0) {
    aiClusters.push({
      id: "other",
      label: "Other responses",
      responseIndices: Array.from(otherSet).sort((a, b) => a - b),
    });
  }
  return { ok: true, clusters: aiClusters };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, reason: "method_not_allowed" });

  // --- Auth ---
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(401, { ok: false, reason: "unauthenticated" });
  }
  const jwt = authHeader.slice("Bearer ".length);
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json(401, { ok: false, reason: "unauthenticated" });
  }
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Role check — research insights access.
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const userRoles = (roles ?? []).map((r: any) => String(r.role));
  if (!userRoles.some((r) => ALLOWED_ROLES.has(r))) {
    return json(403, { ok: false, reason: "forbidden" });
  }

  // --- Validate body ---
  let body: any;
  try { body = await req.json(); } catch { return json(400, { ok: false, reason: "invalid_json_body" }); }

  const questionId = typeof body?.questionId === "string" ? body.questionId.trim() : "";
  const questionText = typeof body?.questionText === "string" ? body.questionText.trim() : "";
  const responses = Array.isArray(body?.responses) ? body.responses : null;
  const clientHash = typeof body?.responseHash === "string" ? body.responseHash.trim() : "";

  if (!questionId || questionId.length > 200) return json(400, { ok: false, reason: "invalid_questionId" });
  if (!questionText || questionText.length > 500) return json(400, { ok: false, reason: "invalid_questionText" });
  if (!responses || responses.length === 0 || responses.length > MAX_RESPONSES) {
    return json(400, { ok: false, reason: "invalid_responses" });
  }
  if (!clientHash) return json(400, { ok: false, reason: "missing_hash" });

  // Normalize: trim, drop blanks, cap length, preserve order/duplicates.
  const valid: string[] = [];
  for (const r of responses) {
    if (r == null) continue;
    let s = String(r).trim();
    if (!s) continue;
    if (s.length > MAX_RESPONSE_LEN) s = s.slice(0, MAX_RESPONSE_LEN);
    valid.push(s);
  }
  if (valid.length === 0) return json(400, { ok: false, reason: "no_valid_responses" });

  const serverHash = await sha256Hex(JSON.stringify(valid));
  if (serverHash !== clientHash) {
    return json(400, { ok: false, reason: "hash_mismatch" });
  }

  // --- Cache lookup ---
  const { data: cached } = await admin
    .from("payment_experience_open_ended_cluster_cache")
    .select("clusters")
    .eq("question_id", questionId)
    .eq("response_hash", serverHash)
    .eq("model", MODEL)
    .maybeSingle();

  if (cached?.clusters) {
    return json(200, {
      ok: true,
      source: "cache",
      model: MODEL,
      responseHash: serverHash,
      clusters: cached.clusters,
    });
  }

  // --- Build uniques (preserve original indices) ---
  type Unique = { text: string; key: string; count: number; originalIndices: number[] };
  const uniqueMap = new Map<string, Unique>();
  valid.forEach((text, i) => {
    const key = text.toLowerCase().replace(/\s+/g, " ").trim();
    let u = uniqueMap.get(key);
    if (!u) {
      u = { text, key, count: 0, originalIndices: [] };
      uniqueMap.set(key, u);
    }
    u.count += 1;
    u.originalIndices.push(i);
  });
  const allUniques = Array.from(uniqueMap.values()).sort((a, b) => b.count - a.count);
  const head = allUniques.slice(0, MAX_UNIQUES_TO_AI);
  const tail = allUniques.slice(MAX_UNIQUES_TO_AI);

  // --- Call Gemini ---
  const ai = await callGemini(questionText, head.map((u) => ({ text: u.text, count: u.count })));
  if (!ai.ok) return json(200, { ok: false, reason: ai.reason });

  // Map AI clusters' uniques-index -> original response indices.
  const clusterById = new Map<string, {
    id: string; label: string; summary?: string; responseIndices: number[]; labelLower: string;
  }>();
  let otherIndices: number[] = [];

  for (const c of ai.clusters) {
    const indices: number[] = [];
    for (const u1 of c.responseIndices) {
      const u = head[u1 - 1];
      if (u) indices.push(...u.originalIndices);
    }
    if (c.id === "other") {
      otherIndices.push(...indices);
    } else if (indices.length > 0) {
      clusterById.set(c.id, {
        id: c.id,
        label: c.label,
        summary: c.summary,
        responseIndices: indices,
        labelLower: c.label.toLowerCase(),
      });
    }
  }

  // --- Tail merge via deterministic classifier ---
  for (const u of tail) {
    const fb = fallbackClassify(u.text);
    let merged = false;
    if (fb.id !== "other") {
      // Try to merge into existing cluster with matching id or label.
      const byId = clusterById.get(fb.id);
      if (byId) {
        byId.responseIndices.push(...u.originalIndices);
        merged = true;
      } else {
        for (const c of clusterById.values()) {
          if (c.labelLower === fb.label.toLowerCase()) {
            c.responseIndices.push(...u.originalIndices);
            merged = true;
            break;
          }
        }
      }
    }
    if (!merged) otherIndices.push(...u.originalIndices);
  }

  // Sort named clusters by size desc; Other last.
  const namedClusters = Array.from(clusterById.values()).sort(
    (a, b) => b.responseIndices.length - a.responseIndices.length || a.label.localeCompare(b.label),
  );
  // Sort indices ascending for stable display.
  for (const c of namedClusters) c.responseIndices.sort((a, b) => a - b);

  const finalClusters: AICluster[] = namedClusters.map((c) => ({
    id: c.id,
    label: c.label,
    summary: c.summary,
    responseIndices: c.responseIndices,
  }));
  if (otherIndices.length > 0) {
    otherIndices = Array.from(new Set(otherIndices)).sort((a, b) => a - b);
    finalClusters.push({
      id: "other",
      label: "Other responses",
      responseIndices: otherIndices,
    });
  }

  // --- Persist cache ---
  await admin
    .from("payment_experience_open_ended_cluster_cache")
    .upsert(
      {
        question_id: questionId,
        response_hash: serverHash,
        model: MODEL,
        clusters: finalClusters,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "question_id,response_hash,model" },
    );

  return json(200, {
    ok: true,
    source: "ai",
    model: MODEL,
    responseHash: serverHash,
    clusters: finalClusters,
  });
});
