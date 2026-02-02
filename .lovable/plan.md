
# Fix Date Display Issue in Reports Page

## Problem Identified

When filtering by Record Date (January 30th), the records appear in the table but show **incorrect dates** (e.g., January 29th instead of January 30th). This is a **timezone conversion bug**.

## Root Cause

In `src/hooks/useReportsData.ts`, dates are being parsed without timezone awareness:

```typescript
// Current (BROKEN)
bookingDate: new Date(row.booking_date),
moveInDate: new Date(row.move_in_date),
```

When JavaScript parses `'2026-01-30'` without a time component, it interprets this as **midnight UTC**. For users in timezones behind UTC (like EST which is UTC-5), this gets converted to the **previous day** when displayed.

**Example:**
- Database stores: `2026-01-30`
- JavaScript parses as: `2026-01-30T00:00:00Z` (UTC)
- Displayed in EST as: `January 29, 2026 7:00 PM` → **Shows as Jan 29!**

## Solution

Apply the established timezone fix pattern used throughout the codebase - append `T00:00:00` to treat the date as **local midnight** instead of **UTC midnight**:

```typescript
// Fixed
bookingDate: new Date(row.booking_date + 'T00:00:00'),
moveInDate: new Date(row.move_in_date + 'T00:00:00'),
```

This pattern is already used in:
- `BookingsContext.tsx` (line 82-83)
- `useCoachingData.ts` (line 91)
- `PublicWallboard.tsx` (line 79-80)
- `MyQA.tsx` (multiple locations)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useReportsData.ts` | Add `+ 'T00:00:00'` to date parsing (lines 287-288) |

---

## Implementation Details

### Update `useReportsData.ts`

**Line 287-288 - Change from:**
```typescript
bookingDate: new Date(row.booking_date),
moveInDate: new Date(row.move_in_date),
```

**To:**
```typescript
bookingDate: new Date(row.booking_date + 'T00:00:00'),
moveInDate: new Date(row.move_in_date + 'T00:00:00'),
```

Also update the following date fields that use the same pattern:

**Line 308 - `transcribedAt`:**
```typescript
// From:
transcribedAt: row.transcribed_at ? new Date(row.transcribed_at) : undefined,
// Note: This is a timestamp, so it should remain unchanged
```

**Line 315 - `createdAt`:**
```typescript
// From:
createdAt: row.created_at ? new Date(row.created_at) : undefined,
// Note: This is a timestamp with timezone, so it should remain unchanged
```

**Line 319 - `emailVerifiedAt`:**
```typescript
// From:
emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : undefined,
// Note: This is a timestamp with timezone, so it should remain unchanged
```

Only `booking_date` and `move_in_date` need the fix because they are DATE-only columns (no time component). Timestamp columns (`created_at`, `transcribed_at`, etc.) include timezone info and are handled correctly.

---

## Why This Fix Works

| Parse Method | Interpretation | EST Display |
|--------------|----------------|-------------|
| `new Date('2026-01-30')` | UTC midnight | Jan 29, 7:00 PM |
| `new Date('2026-01-30T00:00:00')` | Local midnight | Jan 30, 12:00 AM ✅ |

By appending `T00:00:00`, JavaScript treats the date string as local time instead of UTC, preserving the intended date regardless of the user's timezone.

---

## Expected Result

After this fix:
- Filtering for January 30th will show records with "Jan 30, 2026" in the Record Date column
- All dates in the Reports table will display correctly
- CSV exports will use the correct dates
