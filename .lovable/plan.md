

# Fix Agent My Bookings Page - Complete Investigation

## Summary of Issues Found

After thorough investigation, I identified **two distinct bugs** affecting the My Bookings page for agents:

---

## Issue 1: Dates Displaying One Day Behind (Critical)

**Symptom**: Bookings with `booking_date: 2026-01-30` display as "Jan 29, 2026" in the UI.

**Root Cause**: In `src/hooks/useMyBookingsData.ts` (lines 106-107), dates are parsed incorrectly:

```typescript
bookingDate: new Date(row.booking_date),  // WRONG - parses as UTC midnight
moveInDate: new Date(row.move_in_date),   // WRONG
```

When JavaScript parses `"2026-01-30"` without a time component, it interprets it as **UTC midnight**. For users in western timezones (EST/CST/PST), this shifts to the previous day.

**Correct Pattern** (used in other files like `BookingsContext.tsx`, `useReportsData.ts`):
```typescript
bookingDate: new Date(row.booking_date + 'T00:00:00'),  // CORRECT - local midnight
moveInDate: new Date(row.move_in_date + 'T00:00:00'),  // CORRECT
```

**Fix Location**: `src/hooks/useMyBookingsData.ts` lines 106-107

---

## Issue 2: Hover Cards Show "No contact insights" (Critical)

**Symptom**: Even for bookings with `transcription_status: completed`, the hover card shows "No contact insights" instead of Budget & Timeline, Looking For, Concerns.

**Analysis**: 
- Database verification confirms transcription data exists (Dale Campbell has full `call_key_points` data with budget "$519/week")
- RLS policy on `booking_transcriptions` has been correctly updated to use `has_role()`
- The agent role exists in `user_roles` for the logged-in user
- The `useMyBookingsData` hook code correctly includes the `booking_transcriptions` join
- Network logs show **no requests containing `booking_transcriptions`**

**Root Cause**: The updated `useMyBookingsData.ts` hook code may not be deployed to the preview environment yet, OR there's a caching issue. The network requests observed are still from `BookingsContext` (which doesn't include transcription data).

**Verification Needed**: After deployment, the browser console should show:
```
[useMyBookingsData] Fetching bookings for agent: f7dd2216-9443-4927-9c9b-1c85486c7742
[useMyBookingsData] Fetched 30 bookings
[useMyBookingsData] First booking transcription: [{call_key_points: {...}}]
```

---

## Implementation Plan

### Step 1: Fix Date Parsing Bug

**File**: `src/hooks/useMyBookingsData.ts`

**Change** (lines 106-107):
```typescript
// Before
bookingDate: new Date(row.booking_date),
moveInDate: new Date(row.move_in_date),

// After
bookingDate: new Date(row.booking_date + 'T00:00:00'),
moveInDate: new Date(row.move_in_date + 'T00:00:00'),
```

This matches the pattern used in:
- `src/contexts/BookingsContext.tsx` (lines 82-83)
- `src/hooks/useReportsData.ts` (lines 287-288)
- `src/hooks/useCoachingData.ts` (lines 91, 113)
- `src/pages/PublicWallboard.tsx` (lines 79-80)

### Step 2: Force Fresh Build

After the fix is applied, ensure the preview rebuilds completely so the agent session gets the updated hook code.

---

## Expected Results After Fix

1. **Dates will display correctly**: Jan 30th bookings will show as "Jan 30, 2026"
2. **Hover cards will show insights**: Dale Campbell and other transcribed bookings will display:
   - Budget & Timeline: `$519/wk`
   - Looking For: Member preferences
   - Concerns: Any flagged concerns

---

## Technical Details

### Files to Modify
| File | Change |
|------|--------|
| `src/hooks/useMyBookingsData.ts` | Fix date parsing on lines 106-107 |

### Database Status
- RLS policy for `booking_transcriptions` is correct (uses `has_role()`)
- Agent role exists for user `c2fdfa75-0265-4c07-b168-7e3f58501e2f`
- Transcription data exists with full `call_key_points` for test bookings

### Verification Steps After Fix
1. Log in as agent Megane Boileau
2. Navigate to My Bookings
3. Verify dates show correctly (Jan 30 bookings should show as "Jan 30")
4. Check console for `[useMyBookingsData]` log messages confirming transcription data is loaded
5. Hover over Dale Campbell - should see Budget & Timeline, Looking For, Concerns sections

