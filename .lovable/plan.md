
# Fix Contact Insights in Agent Hover Cards

## Problem Summary

Agents see **"No contact insights"** in hover cards on the My Bookings page even though:
1. The database contains the transcription data (verified: Tracy Compton has full `call_key_points`)
2. The RLS policy is correct (uses `has_role()`)
3. The network request successfully returns `booking_transcriptions` data

## Root Cause Identified

The `useMyBookingsData.ts` hook incorrectly parses the `booking_transcriptions` data.

**Line 101 contains the bug:**
```typescript
const transcription = row.booking_transcriptions?.[0];  // WRONG
```

The Supabase JS client returns embedded relations as:
- **Object** when there's a one-to-one relationship (single record)
- **Array** when there's a one-to-many relationship (multiple records)

Since `booking_transcriptions` has a unique constraint on `booking_id`, it's a one-to-one relationship, so Supabase returns **an object**, not an array. The `[0]` indexing returns `undefined`, causing `callKeyPoints` to be missing.

**Evidence from network logs:**
```json
"booking_transcriptions": {
  "call_summary": "...",
  "call_key_points": { "memberDetails": { "weeklyBudget": 519 }, ... }
}
```
This is an object, not an array like `[{...}]`.

**Correct pattern** (from `useReportsData.ts` line 284):
```typescript
const transcription = row.booking_transcriptions as any;  // CORRECT
```

---

## Solution

Update `src/hooks/useMyBookingsData.ts` line 101 to treat `booking_transcriptions` as an object instead of an array.

**Before:**
```typescript
const transcription = row.booking_transcriptions?.[0];
```

**After:**
```typescript
const transcription = row.booking_transcriptions as any;
```

This matches the pattern used in `useReportsData.ts` where the same join works correctly.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useMyBookingsData.ts` | Change line 101 from `[0]` array access to direct object access |

---

## Expected Results

After this fix:
1. Tracy Compton's hover card will show Budget ($174/wk), Timeline (Feb 1st), Concerns, Preferences
2. Dale Campbell's hover card will show Budget ($519/wk), Timeline, etc.
3. All bookings with `transcription_status: completed` will display their insights in hover cards

---

## Verification Steps

1. Log in as agent Megane Boileau
2. Navigate to My Bookings
3. Hover over "Tracy Compton" - should see:
   - Budget & Timeline: `$174/wk`, Move: February 1st, 12 weeks commitment
   - Looking For: Same house as daughter, prefers bi-weekly payments
   - Concerns: Asked for clarification on the '12-week minimum stay'
4. Hover over "Dale Campbell" - should see:
   - Budget & Timeline: `$519/wk`, Move: February 7th
   - Looking For: South Austin, bi-weekly payments, text before call
   - Concerns: Payment schedule questions, furniture rules
