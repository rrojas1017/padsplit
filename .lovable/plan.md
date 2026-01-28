
## Plan: Fix Update-User-Role Edge Function 401 Error

### Root Cause Analysis
The edge function is returning 401 "Unauthorized" but **the console.log statements never appear in logs**, which proves the function code is NOT executing at all. The 401 is happening at the Supabase runtime level.

I compared with the working `create-user` function and found these differences:

| Aspect | update-user-role (broken) | create-user (working) |
|--------|--------------------------|----------------------|
| Server | `serve()` from std@0.168.0 | `Deno.serve()` native |
| CORS headers | Extended headers | Basic headers |
| Syntax | Older pattern | Modern pattern |

The `std@0.168.0` module may have compatibility issues with the current Supabase edge runtime.

---

### Changes Required

#### 1. Update Edge Function to Use Modern Deno.serve
**File: `supabase/functions/update-user-role/index.ts`**

Replace the old `serve` import with modern `Deno.serve`:

```typescript
// REMOVE this line:
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CHANGE:
serve(async (req) => { ... });

// TO:
Deno.serve(async (req) => { ... });
```

This matches the pattern used in `create-user` which works correctly.

---

#### 2. Full Updated Edge Function

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user's auth
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !requestingUser) {
      console.log('Failed to get user from token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if requesting user is super_admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    console.log(`Role change request from ${requestingUser.email}, role: ${roleData?.role}`);

    if (roleError || roleData?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Only super admins can change user roles' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ... rest of the function remains the same
  } catch (error) {
    // ... error handling
  }
});
```

---

#### 3. Force Re-deploy Edge Function
After the code change, the function needs to be explicitly re-deployed to ensure the new code is running.

---

### Technical Summary

| File | Change |
|------|--------|
| `supabase/functions/update-user-role/index.ts` | Replace `serve` from std@0.168.0 with native `Deno.serve()`, simplify CORS headers |

---

### Expected Result
After this fix:
- The edge function will use the modern `Deno.serve()` pattern (same as working `create-user`)
- Console logs will appear in function logs for debugging
- Role changes will work correctly for super admins
- You'll be able to change Franco's role from Agent to Admin
