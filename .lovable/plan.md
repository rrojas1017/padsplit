

## Grant supervisors access to researcher module

### Changes

**File: `src/App.tsx`**

Add `'supervisor'` to the `allowedRoles` array for all researcher-facing routes:

1. `/research/dashboard` — add `'supervisor'`
2. `/research/campaigns` — add `'supervisor'`
3. `/research/log-call` — add `'supervisor'`
4. `/research/history` — add `'supervisor'`

These four routes currently allow `['researcher', 'super_admin', 'admin']`. Each will become `['researcher', 'super_admin', 'admin', 'supervisor']`.

No database or RLS changes needed — supervisors don't have direct RLS access to `research_calls`, but the existing policies allow viewing via the admin/supervisor hierarchy already in place for bookings with `record_type = 'research'`.

