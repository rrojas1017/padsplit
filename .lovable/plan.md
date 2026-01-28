

## Plan: Fix Role Change 401 Error

### Problem Summary
When trying to change Franco's role from Agent to Admin, you're getting a 401 "Unauthorized" error. This is happening even though you (Roberto Rojas) ARE a super_admin.

---

### Root Cause Analysis

The `update-user-role` edge function has a bug in how it checks the requesting user's role. It uses the USER's authenticated client (with anon key) to query the `user_roles` table, which can fail due to RLS policy timing.

**Current broken code** (update-user-role lines 38-49):
```typescript
// Uses USER client - subject to RLS policies
const { data: roleData, error: roleError } = await supabaseClient
  .from('user_roles')
  .select('role')
  .eq('user_id', requestingUser.id)
  .single();

if (roleError || roleData?.role !== 'super_admin') {
  // Returns 403 "Only super admins can change user roles"
}
```

**Working code in create-user** (lines 89-96):
```typescript
// Uses SERVICE ROLE client - bypasses RLS  
const adminClient = createClient(supabaseUrl, supabaseServiceKey)

const { data: userRole } = await adminClient
  .from('user_roles')
  .select('role')
  .eq('user_id', requestingUser.id)
  .single()
```

The difference: `create-user` uses the service role client to check permissions, which bypasses RLS and works reliably.

---

### Changes Required

#### 1. Fix Role Permission Check
**File: `supabase/functions/update-user-role/index.ts`**

Use the service role client to check the requesting user's role:

```typescript
// Use service role for all privileged operations (move BEFORE role check)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Check if requesting user is super_admin using SERVICE ROLE client
const { data: roleData, error: roleError } = await supabaseAdmin
  .from('user_roles')
  .select('role')
  .eq('user_id', requestingUser.id)
  .single();

if (roleError || roleData?.role !== 'super_admin') {
  return new Response(
    JSON.stringify({ error: 'Only super admins can change user roles' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

#### 2. Update CORS Headers
**File: `supabase/functions/update-user-role/index.ts`**

Add the missing Supabase client headers to prevent CORS issues:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

---

#### 3. Add Better Logging
**File: `supabase/functions/update-user-role/index.ts`**

Add logging to help debug future issues:

```typescript
console.log(`Role change request from user ${requestingUser.id} (${requestingUser.email})`);
console.log(`Requesting user role: ${roleData?.role}`);
```

---

### Technical Summary of All Changes

```text
File: supabase/functions/update-user-role/index.ts

Line 4-6:   Update CORS headers to include all Supabase client headers
Line 38-50: Move supabaseAdmin creation BEFORE role check
            Change role check to use supabaseAdmin instead of supabaseClient
            Add logging for debugging
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/update-user-role/index.ts` | Fix permission check to use service role client, update CORS headers, add logging |

---

### Result
After this fix:
- Role changes will work correctly for super admins
- The edge function will use the service role client to verify permissions (same pattern as create-user)
- CORS headers will include all required Supabase client headers
- Better logging will help diagnose any future issues

