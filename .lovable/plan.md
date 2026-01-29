
# Reports Page Updates: Contact Name & Move-In Date Handling

## Overview

Two terminology and data display issues need to be addressed on the Reports page:

1. **"Member" → "Contact"**: The column currently shows "Member" but now includes both actual members and non-booking callers
2. **Move-In Date on Non-Bookings**: All 3,214 non-booking records show a move-in date identical to the record date, which is meaningless and confusing

---

## Root Cause Analysis

The historical import (`hubspotCallParser.ts` line 376) sets move-in date equal to activity date for ALL records:

```typescript
move_in_date: record.activityDate.toISOString().split('T')[0],
```

This was a design decision because the database requires a `move_in_date` (NOT NULL constraint), but semantically non-booking calls don't have a move-in date.

**Database state:**
| Status | Count | Move-In = Record Date | Has Meaningful Move-In |
|--------|-------|----------------------|------------------------|
| Non Booking | 3,214 | 3,214 (100%) | No |
| Pending Move-In | 1,804 | 1,804 (100%) | Depends on data source |

---

## Solution

### Change 1: Column Header "Member" → "Contact"

Simple label update in the table header and CSV export.

**Files affected:** `src/pages/Reports.tsx`

| Location | Current | New |
|----------|---------|-----|
| Table header (line 666) | `label="Member"` | `label="Contact"` |
| CSV export headers (line 228) | `'Member Name'` | `'Contact Name'` |

---

### Change 2: Hide Move-In Date for Non-Booking Records

Display logic update to show "—" or hide the date when the record status is "Non Booking".

**Option A: Show dash for non-bookings**
```text
Record Date | Move-In Date | Contact | ...
Jan 15, 2025 | —            | John Smith | Non Booking
Jan 15, 2025 | Jan 20, 2025 | Jane Doe  | Pending Move-In
```

**Option B: Show "N/A" for non-bookings**
```text
Record Date | Move-In Date | Contact | ...  
Jan 15, 2025 | N/A          | John Smith | Non Booking
Jan 15, 2025 | Jan 20, 2025 | Jane Doe   | Pending Move-In
```

Recommendation: **Option A (dash)** - cleaner and takes less space.

---

### Change 3: Update CSV Export for Non-Bookings

When exporting, leave the Move-In Date cell empty for non-booking records rather than outputting a meaningless date.

---

## Implementation Details

### Reports.tsx Updates

1. **Line 666** - Update table header:
```typescript
// Before
<SortableHeader column="memberName" label="Member" />

// After
<SortableHeader column="memberName" label="Contact" />
```

2. **Line 691-692** - Conditional move-in date display:
```typescript
// Before
<td className="py-3 px-4 text-sm text-foreground">
  {format(booking.moveInDate, 'MMM d, yyyy')}
</td>

// After
<td className="py-3 px-4 text-sm text-foreground">
  {booking.status === 'Non Booking' ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    format(booking.moveInDate, 'MMM d, yyyy')
  )}
</td>
```

3. **Lines 223-254** - Update CSV export:
```typescript
// Update headers
const headers = [
  'Record Date',
  'Move-In Date',
  'Contact Name',  // Changed from 'Member Name'
  // ... rest unchanged
];

// Update row generation
const rows = records.map(booking => [
  format(booking.bookingDate, 'yyyy-MM-dd'),
  booking.status === 'Non Booking' ? '' : format(booking.moveInDate, 'yyyy-MM-dd'),
  booking.memberName,
  // ... rest unchanged
]);
```

---

## Future Consideration (Not in This Change)

The historical import parser could be updated to set `move_in_date` to NULL for non-bookings, but this would require:
1. Database schema change to make `move_in_date` nullable
2. Migration of existing data
3. Updates throughout the application where `moveInDate` is assumed to exist

This is a larger change that can be addressed separately if needed.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Reports.tsx` | Update "Member" → "Contact" header, conditional move-in date display, CSV export updates |

---

## Visual Result

**Before:**
```text
Record Date   | Move-In Date  | Member       | Status
Jan 15, 2025  | Jan 15, 2025  | John Smith   | Non Booking
Jan 15, 2025  | Jan 20, 2025  | Jane Doe     | Pending Move-In
```

**After:**
```text
Record Date   | Move-In Date  | Contact      | Status
Jan 15, 2025  | —             | John Smith   | Non Booking
Jan 15, 2025  | Jan 20, 2025  | Jane Doe     | Pending Move-In
```
