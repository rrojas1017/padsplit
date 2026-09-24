import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type AppRole = "super_admin" | "admin" | "supervisor" | "researcher" | "agent";
export const ROLE_RANK: Record<AppRole, number> = { super_admin: 50, admin: 40, supervisor: 30, researcher: 20, agent: 10 };
export const ADMINS: AppRole[]   = ["super_admin", "admin"];
export const MANAGERS: AppRole[] = ["super_admin", "admin", "supervisor"];
export const STAFF: AppRole[]    = ["super_admin", "admin", "supervisor", "agent"];
export const RESEARCH: AppRole[] = ["super_admin", "admin", "supervisor", "researcher"];
export const ANY_ROLE: AppRole[] = ["super_admin", "admin", "supervisor", "researcher", "agent"];

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret, " +
    "x-supabase-client-platform, x-supabase-client-platform-version, " +
    "x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export interface UserProfile {
  site_id: string | null; status: string | null;
  can_send_communications: boolean | null; can_send_email: boolean | null;
  can_send_sms: boolean | null; can_send_voice: boolean | null;
}
export interface UserCtx {
  kind: "user"; user: User; userId: string;
  role: AppRole | null; roles: AppRole[]; profile: UserProfile | null;
  userClient: SupabaseClient; // anon key + caller JWT => RLS applies
}
export interface InternalCtx { kind: "internal"; via: "secret" | "service_role"; }
export type AuthCtx = UserCtx | InternalCtx;
export type AuthResult<T> = { ok: true; ctx: T } | { ok: false; response: Response };

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const deny = (status: number, error: string) => ({ ok: false as const, response: jsonResponse(status, { error }) });

const enc = new TextEncoder();
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const x = new Uint8Array(da), y = new Uint8Array(db);
  let diff = (a.length === 0 || b.length === 0) ? 1 : 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(\S+)\s*$/i);
  return m ? m[1] : null;
}

let _admin: SupabaseClient | null = null;
export function adminClient(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

let _internalSecret: string | null = null;
// The internal secret lives in Supabase Vault; read once per cold start through the SECURITY DEFINER RPC
// public.get_internal_function_secret(), which only service_role may execute (it already exists).
async function internalSecret(): Promise<string> {
  if (_internalSecret !== null) return _internalSecret;
  const { data, error } = await adminClient().rpc("get_internal_function_secret");
  if (error || typeof data !== "string") { console.error("[auth] internal secret unavailable"); return ""; }
  _internalSecret = data;
  return _internalSecret;
}

export async function checkInternal(req: Request): Promise<InternalCtx["via"] | null> {
  const provided = req.headers.get("x-internal-secret");
  if (provided) {
    const expected = await internalSecret();
    if (expected.length >= 32 && await timingSafeEqual(provided, expected)) return "secret";
  }
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const tok = bearer(req);
  if (srk && tok && await timingSafeEqual(tok, srk)) return "service_role";
  return null;
}

export async function requireInternal(req: Request): Promise<AuthResult<InternalCtx>> {
  const via = await checkInternal(req);
  return via ? { ok: true, ctx: { kind: "internal", via } } : deny(401, "Unauthorized");
}

export interface RequireUserOpts { allowNoRole?: boolean; allowInactive?: boolean; }

export async function requireUser(req: Request, allowedRoles: AppRole[], opts: RequireUserOpts = {}): Promise<AuthResult<UserCtx>> {
  const jwt = bearer(req);
  if (!jwt) return deny(401, "Unauthorized");
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: u, error: uErr } = await userClient.auth.getUser(jwt);
  if (uErr || !u?.user) return deny(401, "Unauthorized");
  const admin = adminClient();
  const [rolesRes, profRes] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", u.user.id),
    admin.from("profiles").select("site_id,status,can_send_communications,can_send_email,can_send_sms,can_send_voice").eq("id", u.user.id).maybeSingle(),
  ]);
  if (rolesRes.error || profRes.error) { console.error("[auth] role/profile lookup failed"); return deny(500, "Authorization lookup failed"); }
  const roles = (rolesRes.data ?? []).map((r: { role: string }) => r.role as AppRole)
    .filter((r: AppRole) => r in ROLE_RANK).sort((a: AppRole, b: AppRole) => ROLE_RANK[b] - ROLE_RANK[a]);
  const role = roles[0] ?? null;
  const profile = (profRes.data ?? null) as UserProfile | null;
  if (!role && !opts.allowNoRole) return deny(403, "Forbidden: no role assigned");
  if (!opts.allowInactive && profile?.status === "inactive") return deny(403, "Forbidden: account inactive");
  if (role && !allowedRoles.includes(role)) return deny(403, "Forbidden");
  return { ok: true, ctx: { kind: "user", user: u.user, userId: u.user.id, role, roles, profile, userClient } };
}

export async function requireUserOrInternal(req: Request, allowedRoles: AppRole[], opts: RequireUserOpts = {}): Promise<AuthResult<AuthCtx>> {
  const via = await checkInternal(req);
  if (via) return { ok: true, ctx: { kind: "internal", via } };
  return await requireUser(req, allowedRoles, opts);
}

export async function canSeeBooking(ctx: AuthCtx, bookingId: string): Promise<boolean> {
  if (ctx.kind === "internal") return true;
  const { data, error } = await ctx.userClient.from("bookings").select("id").eq("id", bookingId).maybeSingle();
  return !error && !!data;
}
