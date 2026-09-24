import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireUser, adminClient, jsonResponse, corsHeaders, ANY_ROLE } from "../_shared/auth.ts";

// Copied from src/utils/passwordValidation.ts (edge functions cannot import from src/).
const COMMON_PASSWORDS = [
  "password", "password1", "password123", "123456", "12345678", "123456789",
  "qwerty", "qwerty123", "abc123", "letmein", "welcome", "admin", "login",
  "passw0rd", "iloveyou", "sunshine", "princess", "football", "baseball",
  "dragon", "master", "monkey", "shadow", "michael", "jennifer", "jordan",
  "superman", "batman", "trustno1", "hello", "charlie", "donald", "password1!",
];

function unmetRules(pw: string, current: string): string[] {
  const rules: Array<[string, boolean]> = [
    ["At least 8 characters", pw.length >= 8],
    ["At most 128 characters", pw.length <= 128],
    ["One uppercase letter (A-Z)", /[A-Z]/.test(pw)],
    ["One lowercase letter (a-z)", /[a-z]/.test(pw)],
    ["One number (0-9)", /\d/.test(pw)],
    ["One special character (!@#$%^&*)", /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)],
    ["Not a common password", !COMMON_PASSWORDS.includes(pw.toLowerCase())],
    ["Must differ from current password", pw !== current],
  ];
  return rules.filter(([, met]) => !met).map(([label]) => label);
}

function sessionIdFromJwt(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(\S+)\s*$/i);
  if (!m) return null;
  const parts = m[1].split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { session_id?: unknown };
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const auth = await requireUser(req, ANY_ROLE);
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;
    const email = auth.ctx.user.email;

    let body: unknown;
    try { body = await req.json(); } catch { return jsonResponse(400, { error: "Invalid JSON body" }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return jsonResponse(400, { error: "Invalid JSON body" });
    const { currentPassword, newPassword } = body as { currentPassword?: unknown; newPassword?: unknown };
    if (typeof currentPassword !== "string" || currentPassword.length === 0) {
      return jsonResponse(400, { error: "Current password is required" });
    }
    if (typeof newPassword !== "string") {
      return jsonResponse(400, { error: "Password does not meet requirements", unmet: unmetRules("", currentPassword) });
    }
    const unmet = unmetRules(newPassword, currentPassword);
    if (unmet.length > 0) return jsonResponse(400, { error: "Password does not meet requirements", unmet });
    if (!email) return jsonResponse(400, { error: "Current password is incorrect" });

    const verifier = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signErr } = await verifier.auth.signInWithPassword({ email, password: currentPassword });
    if (signErr) return jsonResponse(400, { error: "Current password is incorrect" });

    const admin = adminClient();
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
      app_metadata: { must_change_password: false },
    });
    if (updErr) {
      console.error("[change-own-password] update failed:", updErr.message);
      return jsonResponse(500, { error: "Failed to change password" });
    }

    let n: number | null = null;
    const keep = sessionIdFromJwt(req);
    const { data: revoked, error: revErr } = await admin.rpc("revoke_user_sessions", {
      p_user_id: userId,
      p_keep_session_id: keep,
    });
    if (revErr) console.error("[change-own-password] session revoke failed:", revErr.message);
    else n = typeof revoked === "number" ? revoked : null;

    try {
      const { data: prof } = await admin.from("profiles").select("name,email").eq("id", userId).maybeSingle();
      const { error: logErr } = await admin.from("access_logs").insert({
        user_id: userId,
        user_name: prof?.name || prof?.email || email,
        action: "password_change",
        resource: `Changed own password; other sessions ended: ${n ?? "unknown"}`,
      });
      if (logErr) console.error("[change-own-password] audit log failed:", logErr.message);
    } catch (e) {
      console.error("[change-own-password] audit log failed:", e instanceof Error ? e.message : "unknown");
    }

    return jsonResponse(200, { success: true });
  } catch (e) {
    console.error("[change-own-password] unexpected error:", e instanceof Error ? e.message : "unknown");
    return jsonResponse(500, { error: "Failed to change password" });
  }
});
