

## Plan: Fix Edge Function Authentication Pattern

### Root Cause Identified

After extensive analysis, I found that the issue is using the **service role client** for user verification. According to Supabase's edge function pattern:

- Service role clients cannot reliably verify user JWTs via `getUser(token)` 
- The "Auth session missing!" error occurs because the service role client bypasses the normal auth context

### The Correct Pattern

Per the documented edge function pattern:

```typescript
// 1. Anon key client WITH user's auth header - for identity verification
const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } }
})
const { data: { user }, error } = await supabaseWithAuth.auth.getUser()  // No token param!

// 2. Service role client - for privileged database operations
const adminClient = createClient(supabaseUrl, supabaseServiceKey)
```

Key difference: Call `getUser()` **without** the token parameter on a client that has the Authorization header set globally.

---

### Files to Modify

#### 1. `supabase/functions/update-user-role/index.ts`

**Current (broken):**
```typescript
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
const token = authHeader.replace('Bearer ', '')
const { data: { user: requestingUser }, error: userError } = await supabaseAdmin.auth.getUser(token)
```

**Fixed:**
```typescript
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Client for user identity verification
const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } }
})

// Verify the requesting user
const { data: { user: requestingUser }, error: userError } = await supabaseWithAuth.auth.getUser()

// Service role client for privileged DB operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
```

---

#### 2. `supabase/functions/delete-user/index.ts`

Apply the same pattern - use anon key client with auth header for verification, service role for operations.

---

#### 3. `supabase/functions/create-user/index.ts`  

This function also needs the same fix to ensure consistent behavior.

---

### Technical Implementation Details

For each edge function:

1. Get both keys:
   ```typescript
   const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
   const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
   ```

2. Create auth client with user's header:
   ```typescript
   const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
     global: { headers: { Authorization: authHeader } }
   })
   ```

3. Call `getUser()` without token parameter:
   ```typescript
   const { data: { user: requestingUser }, error } = await supabaseWithAuth.auth.getUser()
   ```

4. Use service role client for all database operations:
   ```typescript
   const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
   // Use supabaseAdmin for .from() queries and .auth.admin operations
   ```

---

### After Implementation

1. Deploy all three edge functions
2. Delete Franco's user via direct database cleanup
3. Test creating a new agent from scratch
4. Test role change functionality
5. Test delete functionality

---

### Database Cleanup

Before testing, I'll also clean up Franco's orphaned records:
- Delete from `profiles` where email = 'franco@padsplit.com'
- Delete from `user_roles` if any exist for that user_id
- Delete from `auth.users` via the edge function or admin API

