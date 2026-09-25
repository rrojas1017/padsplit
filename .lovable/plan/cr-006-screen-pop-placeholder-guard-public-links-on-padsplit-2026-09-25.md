# CR-006 — Screen-pop placeholder guard + public links on padsplit.tools

Size S. Two small, additive changes. No SQL, no migrations, no types.ts, no new dependencies.

## Problem

1. **Unfilled placeholders accepted as real values.** ViciDial uses `--A--name--B--` placeholders in the
   screen-pop URL. If someone opens the template in a plain browser (no ViciDial), the literal
   `--A--uniqueid--B--` reaches the app and is accepted as a call id, so every such manual test shares
   one fake id. The same applies to `lead`, `phone`, `agent`, `campaign` (form) and `uniqueid`/`leadId`
   (recording API).
2. **Public links point to the wrong host.** `src/hooks/useScriptTokens.ts` hard-codes
   `BASE_URL = 'https://padsplit.lovable.app'`, but the business uses `https://padsplit.tools`.

## Investigation results

### `padsplit.lovable.app` references (rg over `src` + `supabase`)

```
src/hooks/useScriptTokens.ts:16:const BASE_URL = 'https://padsplit.lovable.app';
```

**One hit.** `getScriptPublicUrl(token)` (line 18-20) is the only public `/script/` link builder, and
it derives from `BASE_URL`. `ScriptBuilder.tsx` consumes `getScriptPublicUrl()` for both the
"Public Script Link" and the "ViciDial Screen-Pop URL" rows of the External-Link popover, so a single
`BASE_URL` change propagates to both. No other file constructs a public `/script/` link, and no
Supabase/auth redirect URL or backend URL references this host. → Only `useScriptTokens.ts` changes.

### Current helpers (byte-for-byte before edits)

`PublicScriptView.tsx` (lines 111-135):
```ts
const DIALER_CTRL_RE = /[\u0000-\u001f\u007f]/g;
function sanitizeDialer(v: unknown, phone = false): string | undefined {
  try {
    if (typeof v !== 'string') return undefined;
    let s = v.replace(DIALER_CTRL_RE, '').trim();
    if (phone) s = s.replace(/\D/g, '');
    if (!s || s.length > 64 || (phone && s.length > 15)) return undefined;
    return s;
  } catch { return undefined; }
}
```

`submit-public-script/index.ts` (lines 154-165) — identical `cleanDialer`/`phoneDigits` to
`submit-conversation-audio/index.ts` (lines 7-18):
```ts
function cleanDialer(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // deno-lint-ignore no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return s && s.length <= 64 ? s : null;
}
function phoneDigits(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = v.replace(/\D/g, '').slice(0, 15);
  return d || null;
}
```

`DIALER_PARAMS` (`PublicScriptView.tsx:112-115`) maps `uid/lead/phone/agent/campaign` →
`dialer_uid/dialer_lead/dialer_phone/dialer_agent/dialer_campaign`; `readDialerParams()` only sends keys
that survive `sanitizeDialer`, so making `sanitizeDialer` return `undefined` for a placeholder drops the
key entirely.

## Change 1 — Unfilled placeholder = absent value

Rule: a value containing the substring `--A--` or `--B--` (case-sensitive) is treated as missing.
The guard runs on the **raw** string, before any stripping/digit-scraping, so a placeholder can never
yield digits or a trimmed id.

### File A — `src/pages/PublicScriptView.tsx` → `sanitizeDialer`
Add the placeholder check immediately after the `typeof` guard. All other behavior unchanged.

```ts
function sanitizeDialer(v: unknown, phone = false): string | undefined {
  try {
    if (typeof v !== 'string') return undefined;
    if (v.includes('--A--') || v.includes('--B--')) return undefined;
    let s = v.replace(DIALER_CTRL_RE, '').trim();
    if (phone) s = s.replace(/\D/g, '');
    if (!s || s.length > 64 || (phone && s.length > 15)) return undefined;
    return s;
  } catch { return undefined; }
}
```

Effect: every placeholder param (`uid`, `lead`, `phone`, `agent`, `campaign`) is dropped from the body
sent on autosave/final save. The `dialer_*` keys present are exactly those ViciDial filled in. No
parameter → body identical to today. Never rendered/logged (already guaranteed by CR-005 Phase 2).

### File B — `supabase/functions/submit-public-script/index.ts` → `cleanDialer` + `phoneDigits`
`cleanDialer`: same guard applied to the raw value.

```ts
function cleanDialer(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  if (v.includes('--A--') || v.includes('--B--')) return null;
  // deno-lint-ignore no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return s && s.length <= 64 ? s : null;
}
```

`phoneDigits`: return `null` when the raw value contains `--A--` (per spec) so digits are not scraped
out of a placeholder. This guard is added here only (see File C note).

```ts
function phoneDigits(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  if (v.includes('--A--')) return null;
  const d = v.replace(/\D/g, '').slice(0, 15);
  return d || null;
}
```

Covers `dialer_uid/dialer_lead/dialer_agent/dialer_campaign` (via `cleanDialer`) and
`dialer_phone` (via `phoneDigits`) read at lines 238-242.

### File C — `supabase/functions/submit-conversation-audio/index.ts` → `cleanDialer`
Same guard on `cleanDialer` only. `phoneDigits` is **unchanged** here: it handles `phoneNumber` and
`r.caller_phone` (real phone fields from the recording API body and stored rows), never a ViciDial
placeholder, and the spec scopes this file to `cleanDialer`. (Every ViciDial placeholder contains
`--A--`, so any placeholder that did reach `phoneDigits` here would also be caught only if added — but
it is not in scope and is left byte-for-byte.)

```ts
function cleanDialer(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  if (v.includes('--A--') || v.includes('--B--')) return null;
  // deno-lint-ignore no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return s && s.length <= 64 ? s : null;
}
```

Covers `uniqueid` and `leadId` (lines 217-218). Existing control-char strip, trim, ≤64 unchanged.

### What is NOT touched by Change 1
- `isDialerKeyConflict` / `isBookingCallConflict` / linking / merge logic (CR-005 Phase 1 + correctives).
- BUG-005 save model, BUG-006 generation/timeout/Restart, BUG-007 duration/phrase rules, BUG-008
  call-time resolution.
- CR-005 corrective #2 (process-research-record re-trigger on form finalize).
- Credential auth, response shapes, all other functions/pages.

## Change 2 — Public links on padsplit.tools

### File D — `src/hooks/useScriptTokens.ts` (line 16)
One-line change:
```ts
const BASE_URL = 'https://padsplit.tools';
```
`getScriptPublicUrl` (line 19) then emits `https://padsplit.tools/script/<token>`, which flows into
both rows of ScriptBuilder's External-Link popover (Public Script Link + ViciDial Screen-Pop URL) and
into the copy-to-clipboard actions there. No other file needs editing.

Existing tokens and old `padsplit.lovable.app` links keep working: both hosts serve the same app and
the `/script/<token>` route resolves on either.

### What is NOT touched by Change 2
- Supabase/auth redirect URLs (none reference this host).
- Any backend URL or edge-function env var.
- `ScriptBuilder.tsx` — already uses `getScriptPublicUrl`, so no code change needed there.
- `SCREEN_POP_QUERY` constant (line 37) — unchanged.

## Files changed (4, all in scope)

| File | Edit |
|------|------|
| `src/pages/PublicScriptView.tsx` | `sanitizeDialer`: +placeholder guard |
| `supabase/functions/submit-public-script/index.ts` | `cleanDialer`: +guard; `phoneDigits`: +`--A--` guard |
| `supabase/functions/submit-conversation-audio/index.ts` | `cleanDialer`: +guard |
| `src/hooks/useScriptTokens.ts` | `BASE_URL` → `https://padsplit.tools` |

No other file changes. No SQL/migrations/RLS. No `types.ts`. No new dependencies.

## Verification (after approval)

1. `tsgo --noEmit -p tsconfig.app.json` — clean.
2. `deno check supabase/functions/submit-public-script/index.ts` — clean.
3. `deno check supabase/functions/submit-conversation-audio/index.ts` — clean.
4. Deploy `submit-public-script` and `submit-conversation-audio`.
5. Unsigned POST `{}` to each function → same 4xx as today:
   - submit-public-script → `400 {"error":"token is required"}` (public token-auth endpoint).
   - submit-conversation-audio → `401` (credential-auth endpoint).
6. No test surveys or recordings submitted — QA proves live. Nothing published.
