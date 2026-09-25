// Resolve when a call started and its business date (fixed UTC-4, no DST). Pure, no I/O.
export type CallTimeSource = 'body' | 'filename' | 'upload_time';
export interface ResolveCallStartInput {
  explicit?: unknown;
  audioUrl?: string | null;
  now?: Date;
  maxPastMs?: number; // default 400 days
}
export interface ResolvedCallStart { startedAt: Date; date: string; source: CallTimeSource; }

const OFFSET_MS = -4 * 60 * 60 * 1000; // fixed UTC-4, no DST
const MAX_FUTURE_MS = 10 * 60 * 1000;
const DEFAULT_MAX_PAST_MS = 400 * 24 * 60 * 60 * 1000;
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/i;
const FILENAME_RE = /(\d{8})-(\d{6})_/;

export function businessDate(instant: Date): string {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

function inBounds(d: Date, now: Date, maxPastMs: number): boolean {
  const t = d.getTime();
  return Number.isFinite(t) && t <= now.getTime() + MAX_FUTURE_MS && t >= now.getTime() - maxPastMs;
}

export function parseExplicit(v: unknown, now: Date, maxPastMs: number): Date | null {
  if (typeof v !== 'string' || !ISO_WITH_ZONE.test(v.trim())) return null;
  const d = new Date(v.trim());
  return inBounds(d, now, maxPastMs) ? d : null;
}

export function parseFilename(url: string | null | undefined, now: Date, maxPastMs: number): Date | null {
  if (!url) return null;
  const m = FILENAME_RE.exec(url);
  if (!m) return null;
  const [y, mo, da] = [+m[1].slice(0, 4), +m[1].slice(4, 6), +m[1].slice(6, 8)];
  const [h, mi, s] = [+m[2].slice(0, 2), +m[2].slice(2, 4), +m[2].slice(4, 6)];
  if (mo < 1 || mo > 12 || h > 23 || mi > 59 || s > 59) return null;
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (da < 1 || da > daysInMonth) return null;
  const d = new Date(Date.UTC(y, mo - 1, da, h, mi, s) - OFFSET_MS); // local UTC-4 → UTC
  return inBounds(d, now, maxPastMs) ? d : null;
}

export function resolveCallStart(input: ResolveCallStartInput): ResolvedCallStart {
  const now = input.now ?? new Date();
  const maxPast = input.maxPastMs ?? DEFAULT_MAX_PAST_MS;
  const b = parseExplicit(input.explicit, now, maxPast);
  if (b) return { startedAt: b, date: businessDate(b), source: 'body' };
  const f = parseFilename(input.audioUrl, now, maxPast);
  if (f) return { startedAt: f, date: businessDate(f), source: 'filename' };
  return { startedAt: now, date: businessDate(now), source: 'upload_time' };
}
