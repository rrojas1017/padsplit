

## Bug: Research Records Not Properly Filtered for Valid Conversations

### Root Cause
Line 231 in `useReportsData.ts` includes `has_valid_conversation.is.null` in the OR clause. This was intended to avoid hiding sales bookings (which don't have this field set), but it also lets through **103 research records** that were never validated by the conversation detection system.

When the user selects the "Research" filter, the query becomes:
- `record_type = 'research'` AND (`record_type != 'research'` OR `has_valid_conversation IS NULL` OR `has_valid_conversation = true`)
- The first OR term is always false (contradicts the filter), so it simplifies to: research records where `has_valid_conversation` is NULL **or** TRUE
- This returns ~219 records instead of just the 116 valid ones

### Fix (1 file)

**`src/hooks/useReportsData.ts` line 231** — Change the filter to only allow NULL `has_valid_conversation` for non-research records:

```
record_type.neq.research,has_valid_conversation.eq.true
```

This ensures:
- Sales bookings pass through (they're not `research`, so `record_type.neq.research` is true)
- Research records **only** pass if `has_valid_conversation = true`
- Research records with NULL or FALSE `has_valid_conversation` are excluded

### Optional: Backfill the 103 NULL records
There are 103 research records where `has_valid_conversation` has never been set. These should be backfilled by running the conversation detection logic on them so they're properly classified as valid or invalid rather than left in limbo.

