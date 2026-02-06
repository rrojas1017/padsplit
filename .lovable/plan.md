

# Fix: Coaching Hub Not Showing Today's Jeff/Katty Recordings

## Problem Summary
The Coaching Hub shows "No Coaching Data Yet" when filtering by "Today" even though:
1. The transcription pipeline **is working correctly** - manual recordings are being processed automatically (transcription -> Jeff -> QA -> Katty)
2. Today's data **exists in the database** - 21 records have `agent_feedback` and `coaching_audio_url` populated

## Root Cause
The `useCoachingData` hook fetches from `booking_transcriptions` **without ordering by date**. With 5,792+ total records and Supabase's default 1000-row limit, the API returns the **oldest 1000 records** (from late 2025), not today's records.

When the Coaching Hub filters by "Today", it finds 0 matches because the 1000 returned records are all from December 2025 through January 2026.

## Solution
Add `.order()` clause to fetch the **most recent** coaching records first.

## File Changes

### `src/hooks/useCoachingData.ts`

**Lines 48-69** - Add ordering to the Supabase query:

```typescript
// Current (problematic):
let query = supabase
  .from('booking_transcriptions')
  .select(`...`)
  .not('agent_feedback', 'is', null);

// Fixed:
let query = supabase
  .from('booking_transcriptions')
  .select(`
    booking_id,
    agent_feedback,
    coaching_audio_url,
    coaching_audio_generated_at,
    coaching_audio_listened_at,
    bookings!inner (
      id,
      booking_date,
      agent_id,
      member_name,
      market_city,
      market_state,
      transcription_status
    )
  `)
  .not('agent_feedback', 'is', null)
  .order('coaching_audio_generated_at', { ascending: false, nullsFirst: false });
```

## Why This Works

| Before | After |
|--------|-------|
| Returns oldest 1000 records | Returns newest 1000 records |
| Today's 21 records excluded | Today's records included first |
| Filter shows "0 calls" | Filter shows today's coaching |

## Technical Notes

- **Why `coaching_audio_generated_at`?** - Supabase PostgREST doesn't support ordering by nested relation columns (`bookings.booking_date`), so we use a timestamp on the primary table
- **`nullsFirst: false`** - Records without audio (still processing) appear at the end
- **No impact on historical views** - Scrolling/pagination still works; we just prioritize recent data in the initial fetch

## Expected Result
After this change:
- Today's Jeff coaching sessions will appear when filtering by "Today"
- Today's Katty QA coaching will also appear (same query pattern)
- Agent Performance table will populate with current scores
- No breaking changes to historical data viewing

