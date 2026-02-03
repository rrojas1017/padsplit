
# Plan: Filter Non-Booking Records from Booking Insights Analysis

## Problem
The "Booking Insights" analysis in the Communication Insights page is currently analyzing ALL transcribed calls, including "Non Booking" call records. The 771 calls shown includes both actual bookings AND non-booking call activity records.

## Root Cause
The edge function `analyze-member-insights` fetches bookings with completed transcriptions but does not filter out records where `status = 'Non Booking'`.

**Current Query (lines 181-196):**
```text
const { data: bookingsRaw, error: bookingsError } = await supabase
  .from('bookings')
  .select(`...`)
  .eq('transcription_status', 'completed')
  .gte('booking_date', date_range_start)
  .lte('booking_date', date_range_end);
```

The Non-Booking Analysis edge function correctly filters with `.eq('status', 'Non Booking')`, but the Booking Insights function has no status filter.

## Solution
Add a filter to exclude "Non Booking" records from the member insights analysis query.

## File to Modify

| File | Change |
|------|--------|
| `supabase/functions/analyze-member-insights/index.ts` | Add `.neq('status', 'Non Booking')` to the bookings query |

## Technical Change

**Updated Query:**
```text
const { data: bookingsRaw, error: bookingsError } = await supabase
  .from('bookings')
  .select(`
    id, 
    member_name, 
    market_city, 
    market_state,
    booking_date,
    call_duration_seconds,
    booking_transcriptions (
      call_key_points
    )
  `)
  .eq('transcription_status', 'completed')
  .neq('status', 'Non Booking')  // <-- ADD THIS FILTER
  .gte('booking_date', date_range_start)
  .lte('booking_date', date_range_end);
```

## Impact

- Booking Insights will analyze ONLY actual bookings (Pending Move-In, Moved In, Cancelled, etc.)
- Non-Booking call analysis remains unchanged and correctly scoped
- Future analyses will have accurate call counts
- Existing historical analyses are unaffected (they're already stored)

## Verification

After deploying, running a new "Booking Insights" analysis should show a lower call count that reflects only actual bookings, not the full 771 that included non-booking records.
