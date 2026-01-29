

# Add "Non Booking" Status to Bookings Table

## Overview
Update the database constraint to allow "Non Booking" as a valid status value, enabling historical import of all call records including non-booking calls.

---

## What This Changes

| Current Allowed Statuses | New Allowed Statuses |
|--------------------------|----------------------|
| Pending Move-In | Pending Move-In |
| Moved In | Moved In |
| Member Rejected | Member Rejected |
| No Show | No Show |
| Cancelled | Cancelled |
| | **Non Booking** ✨ NEW |

---

## Technical Implementation

### Database Migration

Drop the existing constraint and recreate it with the new status:

```sql
-- Drop the existing constraint
ALTER TABLE bookings 
DROP CONSTRAINT bookings_status_check;

-- Add updated constraint with "Non Booking" included
ALTER TABLE bookings 
ADD CONSTRAINT bookings_status_check 
CHECK (status IN ('Pending Move-In', 'Moved In', 'Member Rejected', 'No Show', 'Cancelled', 'Non Booking'));
```

### File Changes

| File | Change |
|------|--------|
| New migration file | Add constraint update SQL |

---

## After Implementation

- Historical imports will successfully save all records
- Non-booking calls will be tagged with status `Non Booking`
- Reports can filter `WHERE status != 'Non Booking'` if needed
- Existing records remain unchanged

---

## Considerations for Reports

Once non-booking records are in the bookings table, you may want to update dashboards/reports to:
- Filter them out from booking counts: `WHERE status != 'Non Booking'`
- Or create a separate view for call history vs bookings

This gives you flexibility to analyze all calls while keeping booking metrics accurate.

