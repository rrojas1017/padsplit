

## Audit Voice Feedback Triggers

### Problem
Every `triggered_by_user_id` in the `api_costs` table is currently NULL for coaching audio generation -- even when a logged-in user clicks "Play" or "Generate" in the UI. This means we can't audit who triggered expensive TTS generations.

### Root Cause
Both `generate-coaching-audio` and `generate-qa-coaching-audio` edge functions try to resolve the user by creating a Supabase client with `SUPABASE_ANON_KEY`, but that secret **does not exist** in the edge function environment. The `try/catch` silently swallows the error, leaving `triggeredByUserId` as `null`.

### Fix
Replace the failing `anonClient.auth.getUser()` approach with direct JWT decoding using the service role client (which is already available). This is the established pattern used by other edge functions in this project.

### Technical Details

**Files to modify:**

1. **`supabase/functions/generate-coaching-audio/index.ts`** (lines ~99-116)
   - Replace the `anonClient` approach with the existing service role client
   - Use `supabase.auth.getUser(token)` with the already-created service role `supabase` client instead of creating a new anon client
   - This works because the service role client can validate any user's JWT

2. **`supabase/functions/generate-qa-coaching-audio/index.ts`** (lines ~110-127)
   - Same fix: use the service role client that's already instantiated in the function to call `auth.getUser(token)`
   - Remove the unnecessary `anonClient` creation

**What changes in each file:**
```text
BEFORE:
  const anonClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: { user } } = await anonClient.auth.getUser(token);

AFTER:
  const { data: { user } } = await supabase.auth.getUser(token);
```

The service role client (`supabase`) is already created earlier in both functions using `SUPABASE_SERVICE_ROLE_KEY`, which is confirmed to exist. `auth.getUser()` works with the service role client and can resolve any user's JWT token.

**No UI changes needed** -- `supabase.functions.invoke()` already sends the user's auth token automatically.

**Batch functions** (`batch-generate-coaching-audio`, `batch-generate-qa-coaching`) call with the service role key (not a user JWT), so `triggered_by_user_id` will correctly remain null for batch operations, and `is_internal` will default to false (billable).

### Expected Result
After this fix, every time a user clicks "Play" or "Generate" for Jeff or Katty coaching audio, the `api_costs` record will include:
- `triggered_by_user_id`: the UUID of the user who clicked
- `is_internal`: true if the user is a super_admin, false otherwise

This enables full auditability of who triggered each TTS generation and its associated cost.

