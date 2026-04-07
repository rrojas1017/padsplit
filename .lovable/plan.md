

# Fix: Coaching Hub Slow Loading

## Root Cause

Same issue as Coaching Engagement: `useCoachingData()` paginates through ALL `booking_transcriptions` records (1000 at a time), downloading full `agent_feedback` JSON blobs for every historical record. The Coaching Hub defaults to "Last 7 Days" but filters client-side after loading everything.

## Solution

Add optional `dateRange` and `customDates` parameters to `useCoachingData` so it can apply server-side date filtering via `.gte()` / `.lte()` on `bookings.booking_date`. When a date range is provided, the paginated loop will fetch far fewer records.

## Changes

### 1. `src/hooks/useCoachingData.ts`
- Add `dateRange` and `customDates` to `UseCoachingDataOptions`
- In `fetchAllPages()`, accept date params and apply `.gte('bookings.booking_date', startStr).lte('bookings.booking_date', endStr)` when not "all"
- This reduces the query from thousands of records to just the relevant window

### 2. `src/pages/CoachingHub.tsx`
- Pass `dateRange` and `customDates` to `useCoachingData({ dateRange, customDates })`
- Remove the client-side `dateFilteredCoachingBookings` memo (lines 101-112) since filtering now happens server-side
- Use `coachingBookings` directly (already filtered by DB)

### Impact
- "Last 7 Days" (default) loads only recent records — near-instant
- No changes to other pages that use `useCoachingData` without date params (they continue to fetch all, as before)
- All existing UI, charts, and calculations remain unchanged

