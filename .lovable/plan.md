
# Plan: Add "Pending Move-In" Status Option to Reports Page

## Problem
The Reports page status dropdown menu is missing the "Pending Move-In" option. This prevents users from reverting a booking back to its default status after accidentally changing it (as happened when testing jvalerio's supervisor access).

## Current Status Options
| Status | Available | Icon |
|--------|-----------|------|
| Moved In | ✓ | CheckCircle (green) |
| Postponed | ✓ | Clock (primary) |
| No Show | ✓ | CalendarX (muted) |
| Member Rejected | ✓ | XCircle (destructive) |
| Cancelled | ✓ | XCircle (destructive) |
| **Pending Move-In** | ✗ Missing | — |

## Solution
Add a "Pending Move-In" option to the status dropdown, positioned at the top since it's the default/initial booking state.

## File to Modify

| File | Change |
|------|--------|
| `src/pages/Reports.tsx` | Add "Pending Move-In" DropdownMenuItem with Clock icon (yellow/warning color) at the top of the status options list |

## Technical Details

Add a new menu item before "Moved In":

```typescript
<DropdownMenuItem
  onClick={async () => {
    try {
      await updateBooking(booking.id, { status: 'Pending Move-In' });
      toast.success('Status updated to Pending Move-In');
      refetch();
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error('Failed to update status. You may not have permission to edit this booking.');
    }
  }}
  className="text-yellow-600 focus:text-yellow-600"
  disabled={booking.status === 'Pending Move-In'}
>
  <Clock className="h-4 w-4 mr-2" />
  Mark as Pending Move-In
  {booking.status === 'Pending Move-In' && <span className="ml-auto text-xs">✓</span>}
</DropdownMenuItem>
```

## Impact
- Users can now revert bookings back to "Pending Move-In" status
- Follows the same error handling pattern as other status options
- Consistent UI pattern with checkmark indicator for current status
- Disabled when booking is already "Pending Move-In"
