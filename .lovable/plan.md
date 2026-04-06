

# Fix: Proxy Recording Audio Edge Function Auth Error

## Problem
The `proxy-recording-audio` edge function uses `supabase.auth.getClaims()` — a method that **does not exist** in the Supabase JS client. This causes the function to return a 401 error, which the `ProxiedAudioPlayer` displays as "Failed to fetch".

## Solution
Replace `getClaims()` with `getUser()`, matching the pattern used by every other edge function in this project.

| File | Change |
|------|--------|
| `supabase/functions/proxy-recording-audio/index.ts` | Replace the `getClaims` auth block (lines 24-38) with the standard `getUser(token)` pattern used elsewhere |

### Specific Change

Replace:
```typescript
const supabase = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
if (claimsError || !claimsData?.claims) { return 401; }
```

With:
```typescript
const anonClient = createClient(url, anonKey);
const token = authHeader.replace("Bearer ", "");
const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
if (authError || !user) { return 401; }
```

Single file, ~5 lines changed. Everything else in the function (booking lookup, audio fetch, streaming) is correct.

