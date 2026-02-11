

# Track Super Admin Processing as Internal (Non-Billable) Costs

## Problem
All processing costs are logged identically regardless of who triggered them. When a super_admin runs analyses, comparisons, or re-processes calls, those API costs get counted toward PadSplit's invoice -- even though they're internal/administrative actions.

## Solution
Add a `triggered_by_user_id` column and an `is_internal` boolean flag to the `api_costs` table. Edge functions will detect when the requesting user is a super_admin and mark those cost entries as internal. All billing queries and invoice generation will filter out `is_internal = true` records, while the internal cost monitoring dashboard will still show them (with a visual distinction).

## Changes

### 1. Database Migration
Add two columns to `api_costs`:
- `triggered_by_user_id UUID` (nullable, references auth.users)
- `is_internal BOOLEAN DEFAULT false`

```sql
ALTER TABLE public.api_costs
  ADD COLUMN triggered_by_user_id UUID,
  ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT false;
```

### 2. Edge Functions -- Pass User Context and Mark Internal

Each edge function that logs costs needs to:
1. Extract the user ID from the Authorization header (where available)
2. Check if the user is a super_admin via the `user_roles` table
3. Pass `is_internal: true` to the cost log when triggered by a super_admin

**Functions to update (10 files):**
- `transcribe-call/index.ts` -- update `logApiCost` helper to accept `triggered_by_user_id` and `is_internal`
- `reanalyze-call/index.ts` -- same pattern
- `generate-coaching-audio/index.ts` -- same pattern
- `generate-qa-coaching-audio/index.ts` -- same pattern
- `generate-qa-scores/index.ts` -- same pattern
- `batch-generate-qa-scores/index.ts` -- same pattern
- `batch-generate-qa-coaching/index.ts` -- same pattern
- `analyze-member-insights/index.ts` -- same pattern
- `analyze-non-booking-insights/index.ts` -- same pattern (uses direct insert, not helper)
- `compare-llm-providers/index.ts` -- same pattern (uses direct insert)

The `logApiCost` helper in each function will be updated to include the new fields:

```typescript
async function logApiCost(supabase: any, params: {
  // ...existing fields...
  triggered_by_user_id?: string;
  is_internal?: boolean;
}) {
  // ...existing cost calculation...
  await supabase.from('api_costs').insert({
    // ...existing fields...
    triggered_by_user_id: params.triggered_by_user_id || null,
    is_internal: params.is_internal || false,
  });
}
```

A shared helper pattern will check the user's role at the top of each serve handler:

```typescript
// At top of serve handler, after parsing request
let triggeredByUserId: string | null = null;
let isInternal = false;

const authHeader = req.headers.get('Authorization');
if (authHeader) {
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await anonClient.auth.getUser(token);
  if (user) {
    triggeredByUserId = user.id;
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    isInternal = roleData?.role === 'super_admin';
  }
}
```

For functions that are triggered automatically (e.g., via database triggers or webhooks without user auth), `is_internal` will remain `false` and `triggered_by_user_id` will be `null` -- these are legitimate operational costs.

### 3. Frontend -- Billing Queries Exclude Internal Costs

**`src/hooks/useBillingData.ts`:**
- Add `.eq('is_internal', false)` to all `api_costs` queries used for invoice calculation

**`src/components/billing/InvoiceGenerator.tsx`** (if it queries costs directly):
- Add the same filter

**`src/hooks/useRealtimeCostMonitor.ts`:**
- Keep showing internal costs but add a visual badge/indicator
- Add a toggle to show/hide internal costs in the realtime dashboard

**`src/components/billing/RealtimeCostDashboard.tsx`:**
- Show internal costs with a distinct "Internal" badge
- Add summary showing "Billable: $X | Internal: $Y | Total: $Z"

### 4. Cost Overview Cards Update

**`src/components/billing/CostOverviewCards.tsx`:**
- Ensure totals displayed exclude internal costs by default
- Show internal cost total separately as an info card

## Backward Compatibility
- The `is_internal` column defaults to `false`, so all existing records remain billable
- Functions called without auth headers (webhooks, triggers) default to non-internal
- No data loss or retroactive changes

## Files Changed
- Database migration (1 new migration)
- 10 edge functions updated
- 3-4 frontend files updated for billing exclusion and visual indicators
