# Security Fix P6: Authorize 6 AI/utility functions

Scope: the 6 functions below, `_shared/url.ts`, transcribe-call (helper move only), and two small frontend edits. No SQL, RLS, migrations, config.toml, prompts, models, cost logic or other functions.

Pattern in each function: delete the local `const corsHeaders = {...}`, import from `../_shared/auth.ts`, and add `const auth = await <guard>; if (!auth.ok) return auth.response;` right after the OPTIONS return.

## Per function

| # | Function | Local corsHeaders removed | Guard inserted after | config.toml (unchanged) |
|---|---|---|---|---|
| 1 | backfill-markets-from-transcriptions | lines 4-7 | line 130: `requireUser(req, ADMINS)` | false |
| 2 | backfill-pricing-data | lines 4-7 | line 86: `requireUser(req, ADMINS)` | false |
| 3 | aggregate-market-data | lines 3-6 | line 66: `requireUser(req, ADMINS)` | true |
| 4 | compare-stt-providers | lines 5-8 | line 144: `requireUser(req, ADMINS)` | true |
| 5 | parse-research-script | lines 3-7 | line 12: `requireUser(req, ADMINS)` | false |
| 6 | translate-script | lines 3-6 | line 9: custom guard (below) | false |

### 4. compare-stt-providers (extra)
- After the `!kixieUrl` check (lines 149-151), add: `if (!isAllowedRecordingUrl(kixieUrl)) return jsonResponse(400, { error: 'Recording URL not allowed' });`
- `downloadAudio` (line 120): `fetch(kixieUrl, {...})` becomes `safeRecordingFetch(kixieUrl, {...})`, headers unchanged.
- Imports: `isAllowedRecordingUrl, safeRecordingFetch` from `../_shared/url.ts`.

### 6. translate-script (custom guard)
- Replace line 1 import with `serve` + `requireUser, adminClient, jsonResponse, corsHeaders, RESEARCH` from `../_shared/auth.ts`.
- Line 12: parse the body once as `body`, then take `{ intro, closing, rebuttal, questions, targetLanguage, scriptToken }`. Body is read before the guard because the token lives in it.
- Size cap: if `JSON.stringify({intro, closing, rebuttal, questions}).length > 100000`, return 413 `{error:'Input too large'}`.
- Access check:
  - If `scriptToken` is a non-empty string: look up `script_access_tokens` with `adminClient()` (`select id, is_active, expires_at` `.eq('token', scriptToken).maybeSingle()`). The row must exist, `is_active` must be true, and `expires_at` must be null or in the future. Otherwise return 401.
  - Otherwise: `requireUser(req, RESEARCH)`. If that fails, return its 401/403.
- Order: OPTIONS, then parse (bad JSON goes to the existing catch and returns 500, same as today), then size cap, then access check, then the unchanged logic.
- The token is never logged.

## _shared/url.ts
- Line 2: add `".amazonaws.com", ".cloudfront.net", ".googleapis.com"` to `DEFAULT_SUFFIXES`. The https-only, no-IP and no-.local checks stay as they are.
- New export `safeRecordingFetch(url, init)`: a byte-identical move of transcribe-call lines 13-30 (manual redirect, max 3 hops, every hop checked with `isAllowedRecordingUrl`, same error messages).

## transcribe-call (helper move only)
- Delete lines 13-30, the local `safeRecordingFetch`.
- Line 11 becomes `import { isAllowedRecordingUrl, safeRecordingFetch } from "../_shared/url.ts";`.
- Call sites at lines 825 and 1574 are unchanged. Behaviour stays identical except for the wider suffix list, which is item 7 and applies to both functions.

## Frontend (only allowed edits)
- `src/hooks/useScriptTranslation.ts`: `translateScript(script, targetLanguage, scriptToken?: string)`. The invoke body (lines 41-47) adds `...(scriptToken ? { scriptToken } : {})`. `translateAndStore` is unchanged, because signed-in Script Builder users pass the role check.
- `src/pages/PublicScriptView.tsx` line 439: `translateScript(script, 'es', token)`.

## Deploy and test
Deploy these 7 functions: the 6 above plus transcribe-call. Then send anon-key POSTs:
- Functions 1-5 with `{}`: expect 401.
- translate-script with `{}`: expect 401.
- translate-script with `{"scriptToken":"fake"}`: expect 401.

Nothing paid can start in these tests, because every check runs before any AI call or download.

## Notes
- Existing app callers are signed-in admins (Market Intelligence, Settings AI management, Script Builder), or public survey pages that hold a valid token.
- A public survey page whose token was deactivated or has expired will lose on-the-fly translation, with the existing "Proceeding in English" message. Scripts marked ES: Ready don't call the function at all.
- aggregate-market-data and compare-stt-providers stay `verify_jwt=true`, as requested.
