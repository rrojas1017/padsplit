/**
 * One timezone rule for the whole app: business dates are America/New_York
 * calendar dates stored as 'yyyy-MM-dd' strings. All maths here is on those
 * strings (via UTC-noon Date objects, so no DST / local-midnight drift).
 */
export const BUSINESS_TZ = 'America/New_York';

export type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'all' | 'custom';

export interface CustomRangeInput {
  from: Date | string;
  to: Date | string;
}

export interface ResolvedRange {
  from: string | null;
  to: string;
  prevFrom: string | null;
  prevTo: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

function etParts(date: Date): { y: number; m: number; d: number; h: number; min: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, min: get('minute') };
}

/** Today's ET calendar date as 'yyyy-MM-dd'. */
export function businessToday(now: Date = new Date()): string {
  const p = etParts(now);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Minutes since ET midnight for an instant. */
export function etMinutesOfDay(date: Date): number {
  const p = etParts(date);
  return p.h * 60 + p.min;
}

function toUtcNoon(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function fromUtcNoon(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDaysStr(s: string, days: number): string {
  const d = toUtcNoon(s);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcNoon(d);
}

/** Inclusive day count between two 'yyyy-MM-dd' strings. */
export function daysBetweenInclusive(from: string, to: string): number {
  return Math.round((toUtcNoon(to).getTime() - toUtcNoon(from).getTime()) / 86_400_000) + 1;
}

/** Monday of the week containing s. */
export function startOfWeekStr(s: string): string {
  const dow = toUtcNoon(s).getUTCDay(); // 0 = Sun
  return addDaysStr(s, -((dow + 6) % 7));
}

export function startOfMonthStr(s: string): string {
  return `${s.slice(0, 7)}-01`;
}

/** A local calendar Date (e.g. from a date picker) → 'yyyy-MM-dd'. */
export function localDateToYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Display-only: 'yyyy-MM-dd' → local-midnight Date. */
export function ymdToLocalDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}

function customToYmd(v: Date | string): string {
  if (v instanceof Date) return localDateToYmd(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // Serialized Date (e.g. restored from sessionStorage) → local calendar date
  return localDateToYmd(new Date(v));
}

export function resolveRange(preset: RangePreset, custom?: CustomRangeInput, now: Date = new Date()): ResolvedRange {
  const today = businessToday(now);
  const prevOf = (from: string, to: string): { prevFrom: string; prevTo: string } => {
    const n = daysBetweenInclusive(from, to);
    const prevTo = addDaysStr(from, -1);
    return { prevFrom: addDaysStr(prevTo, -(n - 1)), prevTo };
  };
  switch (preset) {
    case 'yesterday': {
      const y = addDaysStr(today, -1);
      return { from: y, to: y, ...prevOf(y, y) };
    }
    case '7d': {
      const from = addDaysStr(today, -6);
      return { from, to: today, ...prevOf(from, today) };
    }
    case '30d': {
      const from = addDaysStr(today, -29);
      return { from, to: today, ...prevOf(from, today) };
    }
    case 'month': {
      const from = startOfMonthStr(today);
      const dom = Number(today.slice(8, 10));
      const prevFrom = startOfMonthStr(addDaysStr(from, -1));
      const prevLen = Number(addDaysStr(from, -1).slice(8, 10));
      const prevTo = `${prevFrom.slice(0, 8)}${pad(Math.min(dom, prevLen))}`;
      return { from, to: today, prevFrom, prevTo };
    }
    case 'all':
      return { from: null, to: today, prevFrom: null, prevTo: null };
    case 'custom': {
      if (custom) {
        let from = customToYmd(custom.from);
        let to = customToYmd(custom.to);
        if (from > to) [from, to] = [to, from];
        return { from, to, ...prevOf(from, to) };
      }
      return { from: today, to: today, ...prevOf(today, today) };
    }
    default:
      return { from: today, to: today, ...prevOf(today, today) };
  }
}

export function presetLabel(preset: RangePreset): string {
  switch (preset) {
    case 'today': return 'Today';
    case 'yesterday': return 'Yesterday';
    case '7d': return 'Last 7 days';
    case '30d': return 'Last 30 days';
    case 'month': return 'This month';
    case 'all': return 'All Time';
    case 'custom': return 'Custom range';
    default: return 'Today';
  }
}
