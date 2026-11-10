// CR-018: shared caller identity rule (Reports › Research, reused by phase 2).
// Pure helpers — no I/O, no logging.

const PLACEHOLDER_PREFIXES = ['api submission', 'public submission'];

export function isRealCallerName(name: string | null | undefined): boolean {
  if (typeof name !== 'string') return false;
  const t = name.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  return !PLACEHOLDER_PREFIXES.some((p) => lower.startsWith(p));
}

export function formatCallerPhone(phone: string | null | undefined): string | null {
  if (typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  let d = trimmed.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return trimmed;
}

export interface CallerIdentity { primary: string; secondary: string | null }

export function callerIdentity({ name, phone }: { name?: string | null; phone?: string | null }): CallerIdentity {
  const formatted = formatCallerPhone(phone);
  if (isRealCallerName(name)) return { primary: (name as string).trim(), secondary: formatted };
  if (formatted) return { primary: formatted, secondary: null };
  return { primary: 'Unknown caller', secondary: null };
}
