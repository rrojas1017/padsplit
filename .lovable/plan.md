# CR-017 follow-up — capture file + numeric listId

No frontend, no other function, no SQL or migration executed. Nothing published.

## A) Capture file (write only, never executed)
- Create `supabase/migrations/20261106140000_capture_cr017_dialer_lists.sql` via shell heredoc as a plain file, with the 76 provided lines byte for byte and one trailing newline.
- Report md5 (expected `f8af8178e58e0aaa20b787cfeaf7d9d5`) and line count (76).

## B) `supabase/functions/submit-conversation-audio/index.ts`
- Change only line 222 (`const listId = ...`). Add a small local helper right above it:
  - JSON number that is finite, an integer and `>= 0` → `String(n)`; then passes through the unchanged `cleanDialer`.
  - String → `cleanDialer` exactly as today.
  - Anything else (boolean, object, NaN, negative, decimal) → null.
- `const listId = listIdValue(body.listId) ?? listIdValue(body.list_id);`
- `cleanDialer`, recordingId/leadId, linking, auth, rate limit and the response stay unchanged.

## Checks
- `deno check` on the function.
- Deploy `submit-conversation-audio`; an empty unsigned `POST {}` must return 401.
