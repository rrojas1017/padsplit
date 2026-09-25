# CR-008 — Derive `leadId` / `recordingId` from the ViciDial recording filename

**Scope:** ONE file — `supabase/functions/submit-conversation-audio/index.ts`. No other file, no database change, no new dependency, nothing published.

## Problem

Today `callKey` and `leadId` come only from the request body:

```ts
const callKey = cleanDialer(body.recordingId) ?? cleanDialer(body.uniqueid);
const leadId  = cleanDialer(body.leadId);
```

When the dialer omits those fields, the recording can't link to a form (no lead match, no phone-only fallback unless `leadId`/`phone` align) and a re-post of the same file can't be detected as a duplicate. Evidence: every one of today's 2,679 real `audioUrl` filenames has the shape

```
YYYYMMDD-HHMMSS_M<19 digits>_<8 digits>_<CAMPAIGN>_<agent>-all.mp3
```

where the `M<19 digits>` tail's last 10 digits are the ViciDial `lead_id` (zero-padded) and the `<8 digits>` are ViciDial's per-file `recording_id` (time-correlated, corr 0.999). We can recover both from the filename when the body doesn't send them.

## Change

### 1. New pure helper (added near `cleanDialer` / `phoneDigits`, ~line 14–19)

```ts
// CR-008: recover lead_id + recording_id from a ViciDial recording filename.
function parseVicidialFilename(audioUrl: string): { leadId: string | null; recordingId: string | null } {
  try {
    const path = audioUrl.split('/').pop() ?? '';
    const name = decodeURIComponent(path.split('?')[0]);
    const m = /^\d{8}-\d{6}_M(\d{19})_(\d{4,12})_/.exec(name);
    if (!m) return { leadId: null, recordingId: null };
    const leadTail = m[1].slice(-10);          // last 10 digits = zero-padded lead_id
    const leadNum = Number(leadTail);
    return {
      leadId: leadNum === 0 ? null : String(leadNum),  // Number() strips zero padding; all-zeros → null
      recordingId: m[2],
    };
  } catch {
    return { leadId: null, recordingId: null };  // never throws
  }
}
```

- Last path segment of the URL, query string stripped, URL-decoded.
- Regex `/^\d{8}-\d{6}_M(\d{19})_(\d{4,12})_/` — date(8)-time(6), `_M`, 19-digit call id, `_`, 4–12-digit recording id, `_`.
- `leadId` = `String(Number(last 10 of group 1))`; `0` (all-zeros) → `null`. `recordingId` = group 2.
- Non-match / any error → `{ leadId: null, recordingId: null }`.

### 2. Resolution order (replaces lines 219–220)

Body values always win. Parsed values are pure digit strings ≤ 12 chars, so they trivially satisfy `cleanDialer`'s ≤64 length rule.

```ts
const parsed  = parseVicidialFilename(audioUrl);
const bodyLead = cleanDialer(body.leadId);
const bodyRec  = cleanDialer(body.recordingId) ?? cleanDialer(body.uniqueid);
const leadId   = bodyLead ?? parsed.leadId;
const callKey  = bodyRec  ?? parsed.recordingId;

const leadSrc = bodyLead ? 'body' : parsed.leadId ? 'filename' : 'none';
const recSrc  = bodyRec  ? 'body' : parsed.recordingId ? 'filename' : 'none';
console.log(`[cr008] ids source lead=${leadSrc} rec=${recSrc}`);   // never logs values
```

`phone10` (line 221) is unchanged and stays below.

### 3. Downstream — unchanged

Nothing past the resolution changes: the id step (duplicate check / legacy uid link with `phoneOk`), CR-007 interval matching (lead ±, then phone fallback), the no-link insert carrying `dialer_call_id` / `dialer_lead_id`, the guarded link update, `patchLinkedBooking`, and the response shape.

### Consequence (confirmed)

New recording rows now carry `dialer_call_id` = the file's `recording_id` even when the dialer sends no `recordingId`. A re-post of the same file therefore hits the existing id-step duplicate path and returns the 200 `duplicate: true` response. Files whose names don't match the pattern behave exactly as today (`parsed` is all-null, `callKey`/`leadId` fall back to body-or-null as before).

### Must NOT change

Credential auth + rate limit, `campaign_key` resolution, the recording host allow-list, BUG-008 call-time resolution (`resolveCallStart`), the CR-006 guard, any other file, the database.

## Unit-style trace of `parseVicidialFilename`

```ts
parseVicidialFilename('20260925-143052_M9251430520001234567_12345678_padtest_agent1-all.mp3')
// group1 = '9251430520001234567' (mo=9, day=25, hhmmss=143052, lead=0001234567)
// last10 = '0001234567' → Number = 1234567
// → { leadId: '1234567', recordingId: '12345678' }

parseVicidialFilename('https://rec.example.com/2026/20260925-143052_M9251430520001234567_12345678_padtest_agent1-all.mp3?download=1&token=xyz')
// query stripped, decoded → same filename
// → { leadId: '1234567', recordingId: '12345678' }

parseVicidialFilename('random-recording.mp3')
// no regex match
// → { leadId: null, recordingId: null }
```

## Verification (after approval)

1. `deno check` on the function — clean (and does not regress the pre-existing unrelated deno errors in other functions).
2. Deploy `submit-conversation-audio`.
3. Unsigned `POST {}` → `401` (credential auth still rejects before any parsing).
4. No real recordings posted.
