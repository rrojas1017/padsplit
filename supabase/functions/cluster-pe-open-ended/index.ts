// AI-powered clustering for Payment Experience open-ended responses.
// - Requires an authenticated caller with research-access role.
// - Persistently caches results in payment_experience_open_ended_cluster_cache.
// - Calls Gemini via the Lovable AI Gateway only on cache miss.
// - Server-side guard ensures non-answers go into a dedicated "no_answer" cluster.
// - Second-pass split breaks up oversized clusters (>25% of total, >30 uniques).

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
const SPLIT_PCT_THRESHOLD = 0.25; // split if >25% of total
const SPLIT_UNIQUES_THRESHOLD = 30; // and >30 uniques
const MAX_SPLITS_PER_QUESTION = 2;
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

// ---- No-answer detection (hard server-side guard) ----
const NO_ANSWER_EXACT = new Set([
  "no", "nope", "n/a", "na", "n.a.", "none", "nothing", "nothing really",
  "no comment", "no answer", "no idea", "no clue", "skip", "pass",
  "i don't know", "i dont know", "idk", "i do not know", "dont know", "don't know",
  "unsure", "not sure", "i'm not sure", "im not sure",
  "-", "--", "...", ".", "?", "n", "nan", "null",
]);
const NO_ANSWER_PATTERNS = [
  /^i\s*(do\s*not|don'?t|dont)\s*(really\s*)?know\b/i,
  /^no\s*(real\s*)?(idea|clue|comment|answer|opinion|thoughts?)\b/i,
  /^not\s*(really\s*)?sure\b/i,
  /^nothing\s*(comes\s*to\s*mind|really|in\s*particular|specific)?\b/i,
  /^i\s*have\s*no\s*(idea|clue|comment|answer|opinion)\b/i,
  /^(can'?t|cannot)\s*think\s*of/i,
];
function isNoAnswer(text: string): boolean {
  const lower = text.toLowerCase().replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  if (!lower) return true;
  if (NO_ANSWER_EXACT.has(lower)) return true;
  if (lower.length <= 30 && NO_ANSWER_PATTERNS.some((re) => re.test(lower))) return true;
  return false;
}

interface AICluster {
  id: string;
  label: string;
  summary?: string;
  responseIndices: number[];
}

function buildSystemPrompt(targetCount: number): string {
  return `You are an expert qualitative researcher clustering open-ended survey responses about payment experience for a dashboard.

HARD RULES:
- Any non-answer ("I don't know", "no idea", "n/a", "nothing", "none", "no comment", "skip", "unsure", blanks) MUST go in a SEPARATE cluster with id "no_answer" and label "No answer / Don't know". NEVER place these in substantive clusters.
- Every numbered response MUST be assigned to exactly one cluster (or "otherIndices" only if truly unclassifiable).
- "Other" is a true residual — minimize it.

GRANULARITY:
- Aim for approximately ${targetCount} substantive clusters (excluding "no_answer" and "other"). Create more if the data clearly supports it.
- NO substantive cluster may exceed ~25% of total responses. If a theme would dominate, SPLIT it by sub-theme (e.g., not just "Pricing" but separate "Lower the price", "Offer discounts/promos", "Reduce fees").
- Cluster labels: short (2-6 words), distinct, specific, non-overlapping. Examples for payment topics:
  * "Lower the price" vs "Offer discounts/promos" vs "Reduce fees" — keep separate.
  * "Autopay setup" vs "Payment reminders" vs "Due-date flexibility" — keep separate.
  * "App is confusing" vs "App crashes/slow" vs "Login problems" — keep separate.
- Each cluster must be meaningfully different from the others. If two clusters could merge under one label, they should be one cluster.

OUTPUT — STRICT JSON only, no preamble, no markdown:
{
  "clusters": [
    { "id": "short-kebab-id", "label": "Short cluster label", "summary": "One-sentence summary.", "memberIndices": [1,2,3] }
  ],
  "otherIndices": [7, 12]
}`;
}

async function callGeminiCluster(
  questionText: string,
  uniques: { text: string; count: number }[],
  targetCount: number,
): Promise<{ ok: true; clusters: AICluster[] } | { ok: false; reason: string }> {
  const numbered = uniques
    .map((u, i) => `${i + 1}. (x${u.count}) ${u.text}`)
    .join("\n");
  const system = buildSystemPrompt(targetCount);
  const user = `Survey question:
"${questionText}"

Numbered unique responses (x{count} = duplicate frequency, treat each numbered item as one response when assigning indices):
${numbered}

Target ~${targetCount} substantive clusters plus a dedicated "no_answer" cluster for non-answers. Output only the JSON.`;

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

// Second-pass split: split one oversized cluster's responses into sub-clusters.
async function callGeminiSplit(
  questionText: string,
  parentLabel: string,
  uniques: { text: string; count: number }[],
): Promise<{ ok: true; subs: { id: string; label: string; summary?: string; uniqueIndices: number[] }[] } | { ok: false; reason: string }> {
  const numbered = uniques.map((u, i) => `${i + 1}. (x${u.count}) ${u.text}`).join("\n");
  const system = `You are splitting one over-broad cluster of payment-experience survey responses into 3-6 more specific sub-clusters for a dashboard.

RULES:
- Create between 3 and 6 sub-clusters. Each must be specific and distinct.
- Sub-cluster labels (2-6 words) must NOT repeat the parent label verbatim.
- Every numbered response MUST go into exactly one sub-cluster (or otherIndices if truly unclassifiable).
- STRICT JSON only.

Output:
{ "clusters": [ { "id": "kebab-id", "label": "Label", "summary": "...", "memberIndices": [1,2] } ], "otherIndices": [] }`;

  const user = `Question: "${questionText}"
Parent cluster being split: "${parentLabel}"

Responses to split:
${numbered}

Output only the JSON.`;

  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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
    console.error("[cluster-pe] split fetch failed", e);
    return { ok: false, reason: "ai_error" };
  }
  if (!res.ok) return { ok: false, reason: "ai_error" };
  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  const parsed = typeof content === "string" ? tolerantJsonParse(content) : content;
  if (!parsed || !Array.isArray(parsed.clusters)) return { ok: false, reason: "invalid_json" };

  const N = uniques.length;
  const seen = new Set<number>();
  const subs: { id: string; label: string; summary?: string; uniqueIndices: number[] }[] = [];
  for (let i = 0; i < parsed.clusters.length; i++) {
    const c = parsed.clusters[i];
    const label = String(c?.label ?? "").trim() || `Sub-cluster ${i + 1}`;
    const id = (typeof c?.id === "string" && c.id.trim()) || slugifyId(label, i);
    const summary = typeof c?.summary === "string" ? c.summary.trim() : undefined;
    const members: number[] = [];
    const raw = Array.isArray(c?.memberIndices) ? c.memberIndices : [];
    for (const v of raw) {
      const idx = Number(v);
      if (!Number.isInteger(idx) || idx < 1 || idx > N || seen.has(idx)) continue;
      seen.add(idx);
      members.push(idx);
    }
    if (members.length > 0) subs.push({ id, label, summary, uniqueIndices: members });
  }
  const leftover: number[] = [];
  for (let i = 1; i <= N; i++) if (!seen.has(i)) leftover.push(i);
  if (leftover.length > 0) {
    subs.push({
      id: slugifyId(parentLabel + "-other", subs.length),
      label: `${parentLabel} (other)`,
      uniqueIndices: leftover,
    });
  }
  return { ok: true, subs };
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

  // Pre-filter no-answers BEFORE Gemini sees them.
  const noAnswerOriginal: number[] = [];
  const substantiveUniques: Unique[] = [];
  for (const u of allUniques) {
    if (isNoAnswer(u.text)) {
      noAnswerOriginal.push(...u.originalIndices);
    } else {
      substantiveUniques.push(u);
    }
  }

  const head = substantiveUniques.slice(0, MAX_UNIQUES_TO_AI);
  const tail = substantiveUniques.slice(MAX_UNIQUES_TO_AI);

  // Target cluster count hint for Gemini
  const targetCount = Math.max(6, Math.min(20, Math.round(substantiveUniques.length / 6)));

  // --- Primary clustering call ---
  let ai: { ok: true; clusters: AICluster[] } | { ok: false; reason: string };
  if (head.length === 0) {
    ai = { ok: true, clusters: [] };
  } else {
    ai = await callGeminiCluster(questionText, head.map((u) => ({ text: u.text, count: u.count })), targetCount);
    if (!ai.ok) return json(200, { ok: false, reason: ai.reason });
  }

  // Build clusters keyed by id; track which head-unique-indices belong to each cluster.
  type WorkCluster = {
    id: string; label: string; summary?: string;
    labelLower: string;
    headUniqueIndices: number[]; // 1-based into head
    originalIndices: number[];
  };
  const clusterById = new Map<string, WorkCluster>();
  const otherSetOriginal = new Set<number>();
  const aiNoAnswerOriginal: number[] = [];

  for (const c of ai.clusters) {
    const isAINoAnswer = c.id === "no_answer" || /no[_\s-]?answer|don'?t\s*know/i.test(c.label);
    if (c.id === "other") {
      for (const u1 of c.responseIndices) {
        const u = head[u1 - 1];
        if (u) {
          // Server-side guard: re-route no-answers to no_answer bucket
          if (isNoAnswer(u.text)) aiNoAnswerOriginal.push(...u.originalIndices);
          else for (const oi of u.originalIndices) otherSetOriginal.add(oi);
        }
      }
      continue;
    }
    const headIdxs: number[] = [];
    const origIdxs: number[] = [];
    for (const u1 of c.responseIndices) {
      const u = head[u1 - 1];
      if (!u) continue;
      // Guard: pull any sneaky no-answer out of substantive clusters
      if (!isAINoAnswer && isNoAnswer(u.text)) {
        aiNoAnswerOriginal.push(...u.originalIndices);
        continue;
      }
      headIdxs.push(u1);
      origIdxs.push(...u.originalIndices);
    }
    if (origIdxs.length === 0) continue;
    if (isAINoAnswer) {
      aiNoAnswerOriginal.push(...origIdxs);
      continue;
    }
    clusterById.set(c.id, {
      id: c.id,
      label: c.label,
      summary: c.summary,
      labelLower: c.label.toLowerCase(),
      headUniqueIndices: headIdxs,
      originalIndices: origIdxs,
    });
  }

  // --- Tail merge via deterministic classifier ---
  for (const u of tail) {
    const fb = fallbackClassify(u.text);
    let merged = false;
    if (fb.id !== "other") {
      const byId = clusterById.get(fb.id);
      if (byId) {
        byId.originalIndices.push(...u.originalIndices);
        merged = true;
      } else {
        for (const c of clusterById.values()) {
          if (c.labelLower === fb.label.toLowerCase()) {
            c.originalIndices.push(...u.originalIndices);
            merged = true;
            break;
          }
        }
      }
    }
    if (!merged) for (const oi of u.originalIndices) otherSetOriginal.add(oi);
  }

  // --- Second-pass split: oversized substantive clusters ---
  const totalResponses = valid.length;
  const sizeThreshold = Math.ceil(totalResponses * SPLIT_PCT_THRESHOLD);
  const splitCandidates = Array.from(clusterById.values())
    .filter((c) => c.originalIndices.length > sizeThreshold && c.headUniqueIndices.length > SPLIT_UNIQUES_THRESHOLD)
    .sort((a, b) => b.originalIndices.length - a.originalIndices.length)
    .slice(0, MAX_SPLITS_PER_QUESTION);

  for (const parent of splitCandidates) {
    // Build the unique list for this cluster (from head).
    const subUniques = parent.headUniqueIndices
      .map((h1) => head[h1 - 1])
      .filter(Boolean) as Unique[];
    if (subUniques.length < 4) continue;
    const split = await callGeminiSplit(
      questionText,
      parent.label,
      subUniques.map((u) => ({ text: u.text, count: u.count })),
    );
    if (!split.ok || split.subs.length < 2) continue;
    // Replace parent with sub-clusters.
    clusterById.delete(parent.id);
    for (const sub of split.subs) {
      const origs: number[] = [];
      for (const idx1 of sub.uniqueIndices) {
        const u = subUniques[idx1 - 1];
        if (u) origs.push(...u.originalIndices);
      }
      if (origs.length === 0) continue;
      // Avoid id collision
      let id = sub.id;
      let n = 2;
      while (clusterById.has(id)) id = `${sub.id}-${n++}`;
      clusterById.set(id, {
        id,
        label: sub.label,
        summary: sub.summary,
        labelLower: sub.label.toLowerCase(),
        headUniqueIndices: [],
        originalIndices: origs,
      });
    }
  }

  // --- Assemble final output ---
  const namedClusters = Array.from(clusterById.values())
    .map((c) => ({
      id: c.id,
      label: c.label,
      summary: c.summary,
      responseIndices: Array.from(new Set(c.originalIndices)).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.responseIndices.length - a.responseIndices.length || a.label.localeCompare(b.label));

  const finalClusters: AICluster[] = [...namedClusters];

  // No-answer bucket (pre-filtered + any AI-routed)
  const allNoAnswer = Array.from(new Set([...noAnswerOriginal, ...aiNoAnswerOriginal])).sort((a, b) => a - b);
  if (allNoAnswer.length > 0) {
    finalClusters.push({
      id: "no_answer",
      label: "No answer / Don't know",
      summary: "Respondents declined to answer or said they didn't know.",
      responseIndices: allNoAnswer,
    });
  }

  if (otherSetOriginal.size > 0) {
    finalClusters.push({
      id: "other",
      label: "Other responses",
      responseIndices: Array.from(otherSetOriginal).sort((a, b) => a - b),
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
