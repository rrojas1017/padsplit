

# Fix Reclassify-Other-Records — Query Bug

## Problem
The `reclassify-other-records` edge function has a pagination bug. It fetches ALL records with `.range(offset, offset + BATCH_SIZE - 1)`, then filters for "Other" client-side. Since most records aren't "Other", the filtered batch is empty → 0 records reclassified. The function returns `batch_size: 0, reclassified: 0` despite 125 "Other" records existing.

## Fix

### 1. `supabase/functions/reclassify-other-records/index.ts`
Replace the broken pagination approach with a direct JSONB filter query:

- Use `.eq('research_classification->>primary_reason_code', 'Other')` to let PostgREST filter at the database level
- Also fetch records with codes containing "other" or "unspecified" in a second pass
- Remove the offset-based pagination — instead just `.limit(BATCH_SIZE)` since processed records get `research_audit` set (which excludes them via `.is('research_audit', null)`)
- Self-chaining still works: each batch processes 10, stamps `research_audit`, then the next batch picks up the next 10 unprocessed "Other" records

Key query change:
```
// Before (broken): fetch all, filter client-side
.range(offset, offset + BATCH_SIZE - 1)

// After (fixed): filter at DB level, limit batch
.or('research_classification->>primary_reason_code.eq.Other,research_classification->>primary_reason_code.ilike.%other%,research_classification->>primary_reason_code.ilike.%unspecified%')
.is('research_audit', null)
.limit(BATCH_SIZE)
```

Remove the `offset` parameter entirely — it's not needed since `research_audit IS NULL` naturally excludes already-processed records.

### 2. UI button behavior stays the same
The reclassify banner and button in `ReasonCodeChart.tsx` already work correctly — they just weren't producing results because the backend was broken. No UI changes needed.

## Files
| File | Action |
|------|--------|
| `supabase/functions/reclassify-other-records/index.ts` | Fix query to filter "Other" at DB level |

