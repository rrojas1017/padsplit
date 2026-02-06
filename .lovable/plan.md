
## Problem Analysis

The `batch-retry-transcriptions` function has a critical logic gap:
- **Line 195** filters for `transcription_status IN ['failed', 'pending']`, which excludes bookings with `NULL` status
- Bookings created **before the auto-trigger was deployed** have `NULL` status and are never caught by the retry logic
- This creates a growing backlog of unprocessed records from earlier dates

## Solution

### Part 1: Fix batch-retry-transcriptions Edge Function
**Change line 195** to also include `NULL` status bookings:

```typescript
// Current (WRONG - misses NULL records):
.in('transcription_status', ['failed', 'pending'])

// Fixed (CORRECT - includes all unprocessed):
.or('transcription_status.is.null,transcription_status.in.(failed,pending)', { referencedTable: 'bookings' })
```

**Alternative cleaner approach:**
```typescript
// Instead of .in(), use filtering logic:
.or('transcription_status.is.null')
.or('transcription_status.eq.failed')
.or('transcription_status.eq.pending')
```

Or use raw `.filter()` with OR conditions. The Supabase JS client supports this with `.or()` syntax.

### Part 2: Verify Processing Completion

After fixing, I'll wait ~9-10 minutes and then verify:
1. Query the database for remaining `NULL` status bookings in February 2026
2. Check `transcription_status` for the 18 manually-queued bookings (from your earlier manual trigger)
3. Confirm all have either:
   - Status = `'completed'` (success)
   - Status = `'failed'` with error message (failed but logged)
   - Status = `'pending'` (still processing)

### Expected Outcome

**Before Fix:**
- 18 records stuck at `NULL` status (invisible to auto-retry)
- Batch function would report "no failed bookings found" on future runs

**After Fix:**
- All 18 `NULL` status bookings get caught on the next retry scan
- Future bookings created before auto-trigger is enabled won't slip through the cracks
- Batch-retry becomes a true catch-all for all unprocessed transcriptions

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/batch-retry-transcriptions/index.ts` | Update line 195 to include `NULL` status in query filter |

