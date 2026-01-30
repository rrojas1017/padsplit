
# Fix Status Change Dropdown for Supervisors on Reports Page

## Problem
Supervisors cannot see the 3-dot dropdown menu to change record status (Pending Move-In → Moved In, etc.) on the Reports page. The dropdown is hidden because of a **race condition** in the permission check.

## Root Cause

The `canEditBooking` function checks if a supervisor can edit a booking:

```typescript
if (user.role === 'supervisor') {
  const agent = agents.find(a => a.id === bookingAgentId);
  return agent?.siteId === user.siteId;
}
```

**Problem:** If the `agents` array is empty (still loading), `agents.find()` returns `undefined`, causing `undefined === user.siteId` to return `false`. This hides the dropdown entirely.

## Solution

Update the Reports page to:
1. Get the `isLoading` state from `useAgents()`
2. Modify `canEditBooking` to show the dropdown when agents are still loading (optimistic approach - backend RLS validates actual permissions)

## What Changes

| Current Behavior | New Behavior |
|-----------------|--------------|
| Dropdown hidden if agents haven't loaded | Dropdown shown while agents load |
| Supervisor sees nothing on page load | Supervisor sees 3-dot menu immediately |
| Race condition causes permanent hiding | Graceful loading state handling |

## Technical Implementation

**File:** `src/pages/Reports.tsx`

### Change 1: Get isLoading from useAgents (line 84)
```typescript
// Before:
const { agents } = useAgents();

// After:
const { agents, isLoading: agentsLoading } = useAgents();
```

### Change 2: Update canEditBooking function (lines 206-218)
```typescript
const canEditBooking = (bookingAgentId: string) => {
  if (!user) return false;
  
  // Admin/super_admin always have access
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  
  // Supervisor check - if agents still loading, allow action optimistically
  // (backend RLS will validate actual permission on save)
  if (user.role === 'supervisor') {
    if (agentsLoading || agents.length === 0) return true;
    const agent = agents.find(a => a.id === bookingAgentId);
    return agent?.siteId === user.siteId;
  }
  
  // Agent check
  if (user.role === 'agent') {
    if (agentsLoading || agents.length === 0) return true;
    const agent = agents.find(a => a.id === bookingAgentId);
    return agent?.userId === user.id;
  }
  
  return false;
};
```

## Why This Works
- **Optimistic UI**: The dropdown appears immediately while data loads
- **Backend Validation**: Even if the frontend shows the dropdown, the actual `updateBooking()` call goes through Supabase RLS policies which enforce proper permissions
- **Security Maintained**: No security risk since backend validates all updates

## Files Changed
| File | Change |
|------|--------|
| `src/pages/Reports.tsx` | Add `isLoading` from useAgents, update `canEditBooking` logic |

## Testing
1. Log in as a supervisor
2. Navigate to Reports page
3. Verify the 3-dot dropdown appears on each row
4. Click a status change option (e.g., "Mark as Moved In")
5. Verify the status updates successfully with a toast notification
