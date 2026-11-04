# CR-016 — Capture ViciDial list_id on every research call

## Controlling rules (CR-005, restated)
- Dialer values from URL or API body are untrusted: strings only; control characters stripped, trimmed; >64 chars treated as absent; values containing `--A--` or `--B--` treated as absent; never rendered raw, never logged raw.
- Use the existing `cleanDialer` in each function and the existing `sanitizeDialer` in `PublicScriptView`. No new parsing rules.
- Never overwrite a non-null stored `dialer_list_id`; never block/reject a request over this field (invalid = dropped).
- Linking, adoption, duplicate detection, BUG-005 save model, CR-012 outcomes and response shapes unchanged. The list id is stored only, never used to match or link.

## Changes
1. `supabase/functions/submit-conversation-audio/index.ts`
   - `const listId = cleanDialer(body.listId) ?? cleanDialer(body.list_id);`
   - Add `dialer_list_id` to `RC_SELECT`.
   - New-row inserts (no-link insert ~L323, the create-first insert ~L341, and the duplicate-key retry insert): spread `...(listId ? { dialer_list_id: listId } : {})`.
   - Link/patch of an existing row (uid / lead / fallback link and the booking-conflict path, ~L387): `...(linkRow.dialer_list_id == null && listId ? { dialer_list_id: listId } : {})`.
   - Duplicate path (~L242 early return): untouched.
2. `supabase/functions/submit-public-script/index.ts`
   - Destructure `dialer_list`; `const dialerList = cleanDialer(dialer_list);`
   - `insertRow` (linked + unlinked): `...(dialerList ? { dialer_list_id: dialerList } : {})`.
   - Add `dialer_list_id` to `DIALER_SELECT`; adopt update: set only if `d.dialer_list_id == null`.
   - `_dialer` blob of unlinked rows: add `list: dialerList` next to uid/lead/agent/campaign.
   - In-progress and terminal updates on an existing own row (~L923/L941): include `dialer_list_id` only if the row's current value is NULL (add the column to that row's existing select, or use a guarded `.is('dialer_list_id', null)` separate update — chosen form: add to existing select and conditionally spread, so no extra round-trip and no change to the save model).
3. `src/pages/PublicScriptView.tsx`: add `['list', 'dialer_list', false]` to the existing param table (read once with uid/lead/phone/agent/campaign via `sanitizeDialer`); it then rides every save like `dialer_lead`, kept across Restart, never rendered.
4. `src/pages/research/ScriptBuilder.tsx`: append `&list=--A--list_id--B--` to `SCREEN_POP_QUERY`; mention `list` in the help line.
5. `src/pages/ApiDocs.tsx`: add `listId` body field (optional string, ViciDial `list_id`, ≤64 chars, stored for reporting, not used for linking); add `list` to the screen-pop URL and its explanation. `src/utils/postmanCollection.ts`: add `listId` to the sample body.
6. `src/integrations/supabase/types.ts`: currently lacks `dialer_list_id`; add `dialer_list_id: string | null` (Row) / optional (Insert, Update) to `research_calls`, or regenerate.
7. Capture file `supabase/migrations/20261104200000_capture_cr016_dialer_list_id.sql` written via shell as a plain file with the exact given content + one trailing newline; never executed. Report md5 (expected `68ff9023e9bd3085b819b7ad3f1e656a`).
8. Deploy only `submit-conversation-audio` and `submit-public-script`.

## Not changed
Auth/API credentials/rate limit, campaign resolution, recording host allow-list, link/adopt/duplicate logic, merge rules, CR-012 outcomes, response bodies, RLS, DB, other functions, dashboards, Reports. No logging of the value.

## Acceptance
- `tsgo --noEmit -p tsconfig.app.json` clean.
- `deno check` clean for both functions; both deployed.
- Unsigned `POST {}` to each returns its current status (401 / current error).
- md5 reported; nothing published.
