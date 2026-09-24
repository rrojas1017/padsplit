import { requireUser, adminClient, jsonResponse, corsHeaders } from "../_shared/auth.ts";

// Copied from src/utils/passwordValidation.ts (edge functions cannot import from src/).
const COMMON_PASSWORDS = [
  "password", "password1", "password123", "123456", "12345678", "123456789",
  "qwerty", "qwerty123", "abc123", "letmein", "welcome", "admin", "login",
  "passw0rd", "iloveyou", "sunshine", "princess", "football", "baseball",
  "dragon", "master", "monkey", "shadow", "michael", "jennifer", "jordan",
  "superman", "batman", "trustno1", "hello", "charlie", "donald", "password1!",
];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unmetRules(pw: string): string[] {
  const rules: Array<[string, boolean]> = [
    ["At least 8 characters", pw.length >= 8],
    ["At most 128 characters", pw.length <= 128],
    ["One uppercase letter (A-Z)", /[A-Z]/.test(pw)],
    ["One lowercase letter (a-z)", /[a-z]/.test(pw)],
    ["One number (0-9)", /\d/.test(pw)],
    ["One special character (!@#$%^&*)", /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)],
    ["Not a common password", !COMMON_PASSWORDS.includes(pw.toLowerCase())],
  ];
  return rules.filter(([, met]) => !met).map(([label]) => label);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const auth = await requireUser(req, ["super_admin"]);
    if (!auth.ok) return auth.response;
    const callerId = auth.ctx.userId;

    let body: unknown;
    try { body = await req.json(); } catch { return jsonResponse(400, { error: "Invalid JSON body" }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return jsonResponse(400, { error: "Invalid JSON body" });
    const { userId, newPassword } = body as { userId?: unknown; newPassword?: unknown };

    if (typeof userId !== "string" || !UUID_RE.test(userId)) return jsonResponse(400, { error: "Invalid userId" });
    if (userId === callerId) return jsonResponse(400, { error: "You cannot reset your own password here" });
    if (typeof newPassword !== "string") {
      return jsonResponse(400, { error: "Password does not meet requirements", unmet: unmetRules("") });
    }
    const unmet = unmetRules(newPassword);
    if (unmet.length > 0) return jsonResponse(400, { error: "Password does not meet requirements", unmet });

    const admin = adminClient();
    const { data: roleRows, error: roleErr } = await admin.from("user_roles").select("role").eq("user_id", userId).limit(1);
    if (roleErr) { console.error("[admin-reset-password] role lookup failed:", roleErr.message); return jsonResponse(500, { error: "Failed to update password" }); }
    if (!roleRows || roleRows.length === 0) return jsonResponse(404, { error: "User not found" });

    const [callerProf, targetProf] = await Promise.all([
      admin.from("profiles").select("name,email").eq("id", callerId).maybeSingle(),
      admin.from("profiles").select("name,email").eq("id", userId).maybeSingle(),
    ]);

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
      app_metadata: { must_change_password: true },
    });
    if (updErr) {
      console.error("[admin-reset-password] update failed:", updErr.message);
      return jsonResponse(500, { error: "Failed to update password" });
    }

    let sessionsRevoked: number | null = null;
    const { data: n, error: revErr } = await admin.rpc("revoke_user_sessions", { p_user_id: userId });
    if (revErr) console.error("[admin-reset-password] session revoke failed:", revErr.message);
    else sessionsRevoked = typeof n === "number" ? n : null;

    try {
      const callerName = callerProf.data?.name || callerProf.data?.email || auth.ctx.user.email || "unknown";
      const targetName = targetProf.data?.name || targetProf.data?.email || "unknown";
      const { error: logErr } = await admin.from("access_logs").insert({
        user_id: callerId,
        user_name: callerName,
        action: "password_reset",
        resource: `Password reset for ${targetName} (${userId}); sessions ended: ${sessionsRevoked ?? "unknown"}`,
      });
      if (logErr) console.error("[admin-reset-password] audit log failed:", logErr.message);
    } catch (e) {
      console.error("[admin-reset-password] audit log failed:", e instanceof Error ? e.message : "unknown");
    }

    return jsonResponse(200, { success: true, sessionsRevoked });
  } catch (e) {
    console.error("[admin-reset-password] unexpected error:", e instanceof Error ? e.message : "unknown");
    return jsonResponse(500, { error: "Failed to update password" });
  }
});
