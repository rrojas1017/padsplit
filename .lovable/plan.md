

# Reports: Only Show Successful Research Calls

## Problem
The Reports page currently shows all 1,172 research records. Of these, 179 have `has_valid_conversation = false` (voicemails, no-answers, failed connections). The user wants only successful research calls displayed.

## Data Analysis
- 991 research records have `has_valid_conversation = true` (successful)
- 179 have `has_valid_conversation = false` (unsuccessful)
- 2 have `null` (unknown)
- None have `research_call_id` linked, so we cannot filter by `research_calls.call_outcome`

## Fix
**File: `src/hooks/useReportsData.ts`**

In the main query builder, after applying the `record_type` filter, add a condition: when fetching research records (either `recordTypeFilter === 'research'` or `recordTypeFilter === 'all'`), exclude research records where `has_valid_conversation = false`.

The cleanest approach: add an `.or()` filter that says "either it's not a research record, or it's a research record with a valid conversation":

```ts
// After existing filters, exclude failed research calls
query = query.or('record_type.neq.research,has_valid_conversation.is.null,has_valid_conversation.eq.true');
```

This ensures:
- All booking/non-booking records pass through unchanged
- Research records only appear if `has_valid_conversation` is `true` or `null`
- The total count drops from ~1,172 to ~993 for research records

## Files Changed
- `src/hooks/useReportsData.ts` — add filter to exclude unsuccessful research calls

