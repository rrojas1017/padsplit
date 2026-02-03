
# Plan: Fix Supervisor Booking Status Modification

## Problem Summary
The supervisor (jvalerio) is unable to modify booking status from the Reports page. Investigation found that the database RLS policies are correctly configured to allow supervisors to update bookings for agents in their assigned site. The root cause is **missing error handling** in the Reports.tsx status update actions.

## Root Cause Analysis

### Database Configuration (Verified Correct)
- User `jvalerio@vixicom.com` has role `supervisor` and is assigned to site `Vixicom` (ID: `51bff06a-3180-4879-b188-a975505067f4`)
- RLS UPDATE policy correctly allows supervisors to update bookings where the agent belongs to the supervisor's site
- The `get_user_site_id` function correctly retrieves the supervisor's site from their profile

### Frontend Issue (Needs Fix)
The Reports.tsx page has inline status update handlers without try/catch:

**Current Code (Reports.tsx lines 901-905):**
```typescript
onClick={async () => {
  await updateBooking(booking.id, { status: 'Moved In' });
  toast.success('Status updated to Moved In');
  refetch();
}}
```

When `updateBooking` throws an error (from RLS denial or any other reason):
1. The `await` fails with an unhandled promise rejection
2. The `toast.success()` never runs
3. No error message is shown to the user
4. The status doesn't change, but the user has no feedback

Compare to **MyBookings.tsx** which handles this correctly:
```typescript
try {
  await updateBooking(pendingStatusChange.bookingId, updates);
  toast.success(`Status updated to "${pendingStatusChange.newStatus}"`);
} catch (error) {
  console.error('Error updating booking:', error);
  toast.error('Failed to update booking status');
}
```

## Solution

### 1. Add Error Handling to Reports.tsx Status Updates

Wrap all status update actions in try/catch blocks with user-friendly error messages:

**Before:**
```typescript
onClick={async () => {
  await updateBooking(booking.id, { status: 'Moved In' });
  toast.success('Status updated to Moved In');
  refetch();
}}
```

**After:**
```typescript
onClick={async () => {
  try {
    await updateBooking(booking.id, { status: 'Moved In' });
    toast.success('Status updated to Moved In');
    refetch();
  } catch (error) {
    console.error('Error updating booking:', error);
    toast.error('Failed to update status. You may not have permission to edit this booking.');
  }
}}
```

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Reports.tsx` | Add try/catch error handling to all 5 status update DropdownMenuItem onClick handlers (Moved In, Postponed, No Show, Member Rejected, Cancelled) |

### Status Update Handlers to Fix (Lines 900-964)
1. **Moved In** (lines 901-905)
2. **Postponed** (lines 914-918)
3. **No Show** (lines 927-931)
4. **Member Rejected** (lines 940-944)
5. **Cancelled** (lines 953-957)

## Impact
- Supervisors will now see clear error messages if an update fails
- Any permission issues will be surfaced to the user immediately
- Console logs will help with debugging
- Successful updates will continue to work as before

## Testing Verification
After implementation:
1. Log in as supervisor (jvalerio@vixicom.com)
2. Navigate to Reports page
3. Find a booking from a Vixicom agent (their site)
4. Click the three-dot menu and select a status change
5. Verify the status updates successfully with a success toast
6. Try to change status on a PadSplit Internal booking (should show error toast)
