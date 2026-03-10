

## Fix: Research Insights page stuck on "Synthesizing results"

### Root cause
Record `67e14d0c-05d2-4d1d-8342-342ca559f058` has been stuck in `status: 'processing'` since March 9th (~9 hours ago). The edge function timed out during the synthesis phase but never wrote `failed` status. Every time you visit the page, `checkExistingAnalysis` finds this stuck record and starts polling it indefinitely.

### Fix (two parts)

**1. Database: Mark the stuck record as failed (migration)**

```sql
UPDATE research_insights 
SET status = 'failed', error_message = 'Timed out during processing'
WHERE id = '67e14d0c-05d2-4d1d-8342-342ca559f058' AND status = 'processing';
```

**2. Frontend: Add staleness detection in `useResearchInsightsPolling.ts`**

In `checkExistingAnalysis`, add a staleness check: if a `processing` record was created more than 30 minutes ago, auto-mark it as failed instead of polling it. This prevents future stuck states from blocking the page.

```typescript
// In checkExistingAnalysis, after finding a processing record:
const createdAt = new Date(data.created_at).getTime();
const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
if (createdAt < thirtyMinutesAgo) {
  // Stale — mark as failed
  await supabase.from('research_insights')
    .update({ status: 'failed', error_message: 'Timed out during processing' })
    .eq('id', data.id);
  return null;
}
```

This requires fetching `created_at` in the select query as well.

**3. Edge function: Add a concurrent invocation guard** (in `generate-research-insights/index.ts`)

Before creating a new insight record, check if there's already a `processing` record. If one exists and is < 30 min old, return an error. If > 30 min old, mark it failed first, then proceed. This prevents orphaned records from accumulating.

### What stays the same
- All insight components and data rendering
- The polling mechanism itself (just adds a staleness check)
- The `processInsights` background function logic

