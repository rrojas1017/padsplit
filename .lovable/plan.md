
# Fix Agent Hover Cards - Root Cause Analysis & Solution

## Problem Summary

Agents see **"No contact insights"** in hover cards on the My Bookings page even though:
1. Transcription data exists in the database (verified: Dale Campbell has full `call_key_points` data)
2. The RLS policy has been updated to use `has_role()` (verified in `pg_policies`)
3. The `useMyBookingsData.ts` hook code appears to have the correct `booking_transcriptions` join

## Root Cause Identified

From the network request analysis, the query being executed does **NOT** include the `booking_transcriptions` join. The captured network request shows:
```
GET /bookings?select=id,member_name,...(no booking_transcriptions)...&booking_date=gte.2025-11-04
```

This is the query from `BookingsContext` (global 90-day fetch), NOT from `useMyBookingsData` hook (which should have `agent_id=eq.xxx` and `booking_transcriptions(...)`).

**The `useMyBookingsData` hook query is not executing at all**, likely due to one of these issues:

1. **Race condition**: The `myAgent` dependency is `null` initially because `agents` array is still loading, causing the hook to return early before `agents` load
2. **Build/deployment timing**: The updated hook file may not have been fully deployed to the preview

## Solution

Ensure the `useMyBookingsData` hook reliably fetches data even when there's a race condition with the agents loading. Add additional safeguards:

---

## Code Changes

### 1. Update `useMyBookingsData.ts` - Add Fallback Fetch on Agent Load

The current hook has this logic:
```typescript
const fetchBookings = useCallback(async () => {
  if (!myAgent) {
    setBookings([]);
    setIsLoading(false);
    return;  // Returns early - never retries when myAgent becomes available
  }
  // ... fetch
}, [myAgent]);

useEffect(() => {
  fetchBookings();
}, [fetchBookings]);
```

The dependency chain should work, but add explicit handling to ensure retry:

```typescript
// Add loading state for agents
const { agents, isLoading: agentsLoading } = useAgents();

// Modify early return to handle loading state
const fetchBookings = useCallback(async () => {
  if (!myAgent) {
    if (!agentsLoading) {
      // Only set empty if agents have finished loading and user has no agent
      setBookings([]);
      setIsLoading(false);
    }
    // Keep loading true while agents are still loading
    return;
  }
  // ... rest of fetch logic
}, [myAgent, agentsLoading]);
```

### 2. Add Console Logging for Debugging

Add temporary logging to verify the query is executing:

```typescript
const fetchBookings = useCallback(async () => {
  console.log('[useMyBookingsData] Fetching for agent:', myAgent?.id);
  
  // ... in the try block after query
  console.log('[useMyBookingsData] Fetched', data?.length, 'bookings');
  console.log('[useMyBookingsData] First booking transcription:', data?.[0]?.booking_transcriptions);
```

### 3. Ensure isLoading from AgentsContext is Exposed

Verify `useAgents()` returns `isLoading`:

```typescript
// In AgentsContext.tsx, the return should include:
return { agents, sites, isLoading, ... }
```

This is already the case per the code review.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useMyBookingsData.ts` | Add `agentsLoading` dependency to prevent premature empty state; add debug logging |

---

## Database Status (Already Fixed)

The RLS policy is already correctly using `has_role()`:

```sql
CREATE POLICY "view_transcription" ON public.booking_transcriptions
FOR SELECT USING (
  has_role(auth.uid(), 'agent'::app_role) AND booking_id IN (
    SELECT b.id FROM bookings b 
    JOIN agents a ON b.agent_id = a.id 
    WHERE a.user_id = auth.uid()
  )
)
```

Verified in database: Policy uses `has_role()` not `get_my_role()`.

---

## Verification Steps

After implementation:
1. Log in as agent "Megane Boileau" (mboileau@vixicom.com)
2. Navigate to My Bookings
3. Check browser console for `[useMyBookingsData]` logs to verify:
   - Agent ID is correctly identified
   - Bookings are fetched with transcription data
4. Hover over "Dale Campbell" - should show Budget ($519/week), Timeline, Concerns

---

## Technical Summary

The fix ensures the `useMyBookingsData` hook:
1. Waits for agents to finish loading before deciding the user has no agent
2. Properly triggers a re-fetch when `myAgent` becomes available
3. Includes debug logging to verify the query execution
