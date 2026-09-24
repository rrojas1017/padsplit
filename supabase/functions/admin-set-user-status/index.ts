import { requireUser, adminClient, jsonResponse, corsHeaders } from "../_shared/auth.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const { userId, active } = body as { userId?: unknown; active?: unknown };
    if (typeof userId !== "string" || !UUID_RE.test(userId)) return jsonResponse(400, { error: "Invalid userId" });
    if (typeof active !== "boolean") return jsonResponse(400, { error: "Invalid active flag" });
    if (userId === callerId) return jsonResponse(400, { error: "You cannot change your own status" });

    const admin = adminClient();
    const { data: roleRows, error: roleErr } = await admin.from("user_roles").select("role").eq("user_id", userId).limit(1);
    if (roleErr) { console.error("[admin-set-user-status] role lookup failed:", roleErr.message); return jsonResponse(500, { error: "Failed to update status" }); }
    if (!roleRows || roleRows.length === 0) return jsonResponse(404, { error: "User not found" });

    const [callerProf, targetProf] = await Promise.all([
      admin.from("profiles").select("name,email").eq("id", callerId).maybeSingle(),
      admin.from("profiles").select("name,email,status").eq("id", userId).maybeSingle(),
    ]);
    const prevStatus: string | null = targetProf.data?.status ?? null;
    const newStatus = active ? "active" : "inactive";

    const { error: profErr } = await admin.from("profiles").update({ status: newStatus }).eq("id", userId);
    if (profErr) { console.error("[admin-set-user-status] profile update failed:", profErr.message); return jsonResponse(500, { error: "Failed to update status" }); }

    const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
    if (banErr) {
      console.error("[admin-set-user-status] auth update failed:", banErr.message);
      if (prevStatus !== null) {
        const { error: rbErr } = await admin.from("profiles").update({ status: prevStatus }).eq("id", userId);
        if (rbErr) console.error("[admin-set-user-status] rollback failed:", rbErr.message);
      }
      return jsonResponse(500, { error: "Failed to update status" });
    }

    let sessionsRevoked: number | null = null;
    if (!active) {
      const { data: n, error: revErr } = await admin.rpc("revoke_user_sessions", { p_user_id: userId });
      if (revErr) console.error("[admin-set-user-status] session revoke failed:", revErr.message);
      else sessionsRevoked = typeof n === "number" ? n : null;
    }

    try {
      const callerName = callerProf.data?.name || callerProf.data?.email || auth.ctx.user.email || "unknown";
      const targetName = targetProf.data?.name || targetProf.data?.email || "unknown";
      const { error: logErr } = await admin.from("access_logs").insert({
        user_id: callerId,
        user_name: callerName,
        action: active ? "user_reactivated" : "user_deactivated",
        resource: active
          ? `Reactivated ${targetName} (${userId})`
          : `Deactivated ${targetName} (${userId}); sessions ended: ${sessionsRevoked ?? "unknown"}`,
      });
      if (logErr) console.error("[admin-set-user-status] audit log failed:", logErr.message);
    } catch (e) {
      console.error("[admin-set-user-status] audit log failed:", e instanceof Error ? e.message : "unknown");
    }

    return jsonResponse(200, { success: true, status: newStatus, sessionsRevoked });
  } catch (e) {
    console.error("[admin-set-user-status] unexpected error:", e instanceof Error ? e.message : "unknown");
    return jsonResponse(500, { error: "Failed to update status" });
  }
});
