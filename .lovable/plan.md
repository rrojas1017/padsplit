

# Fix: Reports Default Should Be "Bookings Only"

## Problem
Reports defaults to "All Records" with today's date. At 1:24 AM on March 5th, no agents have logged in, so there are zero bookings. However, 36 research records were submitted via the external API (35 successful + 1 null conversation status). This is confusing because the user expects the count to reflect agent activity.

## Database Reality (March 5th)
- **0** booking records
- **35** research records with `has_valid_conversation = true`
- **1** research record with `has_valid_conversation = null`
- **6** research records with `has_valid_conversation = false` (correctly filtered out)

## Fix
**File: `src/pages/Reports.tsx`** — Change the default `recordTypeFilter` from `'all'` to `'booking'`.

This single-line change ensures the Reports page opens showing only actual bookings (matching the Dashboard), so at 1:24 AM with no agent activity, the count will correctly show 0. Users can still switch to "All Records" or "Research Only" via the dropdown.

## Files Changed
- `src/pages/Reports.tsx` — default `recordTypeFilter` state from `'all'` → `'booking'`

