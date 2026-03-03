

## Fix: Grant admins full access to researcher module

### Problem
Two researcher-facing routes (`/research/dashboard` and `/research/campaigns`) exclude `super_admin` and `admin` roles. Admins who navigate there get redirected.

### Changes

**File: `src/App.tsx`**
- Line ~307: Add `'super_admin', 'admin'` to the `allowedRoles` array for `/research/dashboard`
- Line ~314: Add `'super_admin', 'admin'` to the `allowedRoles` array for `/research/campaigns`

Both routes change from:
```
allowedRoles={['researcher']}
```
to:
```
allowedRoles={['researcher', 'super_admin', 'admin']}
```

No database or RLS changes needed — the `research_calls` table already grants SELECT/ALL to admins.

