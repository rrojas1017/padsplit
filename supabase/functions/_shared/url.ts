const DEFAULT_HOSTS = ["recordings.vixicom.com", "calls.kixie.com", "app.kixie.com", "app-atl.five9.com", "us9.five9.com", "app.hubspot.com"];
const DEFAULT_SUFFIXES = [".hubspotusercontent-na1.net", ".five9.com", ".kixie.com", ".vixicom.com"];
export function isAllowedRecordingUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  const host = u.hostname.toLowerCase();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":") || host === "localhost" || host.endsWith(".local")) return false;
  const extra = (Deno.env.get("RECORDING_HOST_ALLOWLIST") ?? "").split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
  return [...DEFAULT_HOSTS, ...extra].includes(host) || DEFAULT_SUFFIXES.some((s) => host.endsWith(s));
}
