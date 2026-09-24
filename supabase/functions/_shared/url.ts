const DEFAULT_HOSTS = ["recordings.vixicom.com", "calls.kixie.com", "app.kixie.com", "app-atl.five9.com", "us9.five9.com", "app.hubspot.com"];
const DEFAULT_SUFFIXES = [".hubspotusercontent-na1.net", ".five9.com", ".kixie.com", ".vixicom.com", ".amazonaws.com", ".cloudfront.net", ".googleapis.com"];
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

// Fetch a recording URL without following redirects automatically.
// Follows at most 3 redirect hops, each Location must pass isAllowedRecordingUrl.
export async function safeRecordingFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= 3; hop++) {
    if (!isAllowedRecordingUrl(current)) throw new Error('Recording URL not allowed');
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      if (hop === 3) throw new Error('Too many recording redirects');
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('Too many recording redirects');
}
