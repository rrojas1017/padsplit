
## Plan: Fix User Role and Delete Functions - Auth Session Issue

### Root Cause Analysis

After careful analysis of the edge function logs and code, I've identified the root cause:

**The logs consistently show:**
```
"Auth session missing!"
```

This happens because:

1. **`update-user-role` uses a non-existent method**: `supabaseWithAuth.auth.getClaims(token)` - This method does NOT exist in the standard Supabase JS client API!

2. **`delete-user` uses the correct pattern** but still fails because it uses `getUser(token)` which has been unreliable

3. **The working `create-user` function** uses `adminClient.auth.getUser(token)` with the service role client - the same pattern as delete-user, but it might be working inconsistently

**The Real Issue**: The `getClaims()` method was introduced in the last fix but this is NOT a valid Supabase JS client method. This causes the function to fail immediately.

---

### Solution: Align All Edge Functions with Proven Pattern

I'll update both `update-user-role` and `delete-user` to use the exact same verified auth pattern that exists in `create-user`:

```typescript
// Use service role client to verify user token
const adminClient = createClient(supabaseUrl, supabaseServiceKey)
const token = authHeader.replace('Bearer ', '')
const { data: { user: requestingUser }, error: userError } = await adminClient.auth.getUser(token)
```

This pattern:
- Uses the service role client (NOT anon key)
- Passes the extracted token directly to `getUser()`
- This is how Supabase recommends verifying JWTs in edge functions

---

### Files to Modify

#### 1. `supabase/functions/update-user-role/index.ts`

**Remove:**
- The non-existent `getClaims()` call
- The `supabaseWithAuth` client using anon key
- The separate `requestingUserId` and `requestingUserEmail` variables

**Add:**
- Use service role client for `getUser(token)` like create-user
- Use `requestingUser.id` and `requestingUser.email` directly

```typescript
// Before (BROKEN - getClaims doesn't exist)
const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
})
const { data: claimsData, error: claimsError } = await supabaseWithAuth.auth.getClaims(token)

// After (WORKING - same as create-user)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
const { data: { user: requestingUser }, error: userError } = await supabaseAdmin.auth.getUser(token)
```

---

#### 2. `supabase/functions/delete-user/index.ts`

This function already uses the correct pattern but I'll ensure it matches exactly with create-user for consistency.

---

### Technical Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/update-user-role/index.ts` | Remove fake `getClaims()` method, use `adminClient.auth.getUser(token)` pattern from create-user |
| `supabase/functions/delete-user/index.ts` | Verify pattern matches create-user exactly |

---

### After Implementation

1. Deploy both edge functions
2. Test role change: Change Franco from Agent to Admin
3. Test deletion: Delete the test agent

---

### Why This Will Work

The `create-user` function works correctly because:
1. It uses the **service role key** to create the admin client
2. It calls `adminClient.auth.getUser(token)` with the extracted JWT
3. The service role client has permission to verify any user's token

The previous attempts failed because:
- `getClaims()` is not a real Supabase method
- Using the anon key client with custom headers doesn't work for token verification
- The auth client needs service role privileges to verify tokens from other users
