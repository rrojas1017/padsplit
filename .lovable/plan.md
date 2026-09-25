# BUG-008 — Research records dated by call time, not upload time

## Files (only these)
1. NEW `supabase/functions/_shared/callTime.ts`
2. `supabase/functions/submit-conversation-audio/index.ts`
3. `supabase/functions/submit-public-script/index.ts`
4. `src/pages/PublicScriptView.tsx` (one line)
5. `src/pages/ApiDocs.tsx` (docs exist here: submit-conversation-audio request table + 201 example)
6. NEW `supabase/migrations/20260925180000_capture_bug008_call_started_at.sql` — written only, never run

Not touched: Leaderboard.tsx, SiteFilter.tsx, useAgentGoals.ts, _shared/auth.ts, _shared/url.ts, anything else. No DB change, nothing published.

## 1. `_shared/callTime.ts` (new, pure, no I/O)

```ts
export type CallTimeSource = 'body' | 'filename' | 'upload_time';
export interface ResolveCallStartInput {
  explicit?: unknown;
  audioUrl?: string | null;
  now?: Date;
  maxPastMs?: number; // default 400 days
}
export interface ResolvedCallStart { startedAt: Date; date: string; source: CallTimeSource; }

const OFFSET_MS = -4 * 60 * 60 * 1000;           // fixed UTC-4, no DST
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
```

Acceptance math: `20260922-143015_` → 18:30:15Z, date 2026-09-22. `20260922-233000_` → 2026-09-23T03:30Z, shifted −4 h → 2026-09-22. `2026-09-21T23:30:00-04:00` → date 2026-09-21, source body.

## 2. submit-conversation-audio

- Import: `import { resolveCallStart } from '../_shared/callTime.ts';`
- Body destructure (l.94): add `callTimestamp`.
- Replace `const today = new Date().toISOString().split('T')[0];` (l.188) with:
```ts
const callStart = resolveCallStart({ explicit: callTimestamp, audioUrl });
if (callTimestamp !== undefined && callStart.source !== 'body') {
  console.log('[submit] callTimestamp invalid or out of range, falling back');
}
console.log(`[submit] call_start source=${callStart.source} date=${callStart.date}`);
const today = callStart.date;
```
  (`today` keeps feeding research_calls.call_date, booking_date, move_in_date unchanged.)
- Booking insert: add `call_started_at: callStart.startedAt.toISOString(),`.
- 201 response: add `callDate: callStart.date, callStartedAt: callStart.startedAt.toISOString(), callDateSource: callStart.source,`.
- Invalid callTimestamp is never a 400. The invalid value itself is not logged. Nothing else changes.

## 3. submit-public-script

- Import `resolveCallStart` from `../_shared/callTime.ts`.
- Destructure (l.163–177): add `startedAt,`.
- After the destructure:
```ts
const callStart = resolveCallStart({ explicit: startedAt, audioUrl: '', maxPastMs: 24 * 60 * 60 * 1000 });
```
- `insertRow` (l.487): add `call_date: callStart.date,`. This covers the in_progress insert, the terminal insert and the legacy insert. The update and flip paths don't touch call_date, so the first insert's date stays.
- `finalizeSideEffects` (l.349): `const today = callStart.date;` Add `call_started_at: callStart.startedAt.toISOString(),` to the booking insert. Repair runs reuse the retrying client's own startedAt, which is the same value.
- Old clients without startedAt: source is upload_time, and the date is the UTC-4 date of now.

## 4. PublicScriptView.tsx (one line, after durationSeconds at l.225–227)
```ts
startedAt: startedAtRef.current !== null ? new Date(startedAtRef.current).toISOString() : undefined,
```

## 5. ApiDocs.tsx
- ParamTable: add `{ name: 'callTimestamp', type: 'string', required: false, description: 'Call start as ISO-8601 with offset or Z (e.g. 2026-09-21T23:30:00-04:00). If omitted, the call time is read from the recording filename (YYYYMMDD-HHMMSS_, dialer time UTC-4); otherwise the upload time is used.' }`. Check that ParamTable shows optional fields; if it has no `required: false` support, render it the same way the component already does.
- Example request: add `"callTimestamp": "2026-03-10T14:30:15-04:00",`.
- 201 example: add `"callDate": "2026-03-10", "callStartedAt": "2026-03-10T18:30:15.000Z", "callDateSource": "body"`.

## 6. Capture migration
Exact content from the ticket, trailing newline. Written as a plain file and not applied. I'll report wc -l and md5sum.

## Verification
- deno check on both functions and on the helper, plus tsgo --noEmit -p tsconfig.app.json.
- Deploy only submit-conversation-audio and submit-public-script. Check that an unsigned POST gets 401 (audio) or 400/403 (public).
- A local `deno eval` of resolveCallStart against the four acceptance cases (pure, no DB writes).
