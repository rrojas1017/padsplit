
# Fix Agent Hover Cards - RLS Policy Issue

## Problem Identified

Agents see **"No contact insights"** in hover cards even when transcription data exists. Through investigation, I found the root cause:

The `booking_transcriptions` table's RLS policy uses `get_my_role()` function which **fails during embedded relation queries** (when Supabase JS client uses `.select('..., booking_transcriptions(...)')`).

The current policy:
```sql
get_my_role() = 'agent' AND booking_id IN (
  SELECT b.id FROM bookings b JOIN agents a ON b.agent_id = a.id 
  WHERE a.user_id = auth.uid()
)
```

When the query runs as a nested/embedded relation, the `get_my_role()` function returns NULL, causing the agent clause to fail and returning no transcription data.

## Solution

Update the RLS policy to use `has_role()` function which is designed to work correctly in all query contexts:

```sql
has_role(auth.uid(), 'agent'::app_role) AND booking_id IN (
  SELECT b.id FROM bookings b JOIN agents a ON b.agent_id = a.id 
  WHERE a.user_id = auth.uid()
)
```

---

## Database Changes

Drop and recreate the `view_transcription` policy on `booking_transcriptions`:

```sql
-- Drop existing policy
DROP POLICY IF EXISTS "view_transcription" ON public.booking_transcriptions;

-- Recreate with has_role() for reliability in embedded queries
CREATE POLICY "view_transcription" ON public.booking_transcriptions
FOR SELECT USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'supervisor'::app_role) AND booking_id IN (
    SELECT b.id FROM bookings b 
    JOIN agents a ON b.agent_id = a.id 
    WHERE a.site_id = get_user_site_id(auth.uid())
  )) OR
  (has_role(auth.uid(), 'agent'::app_role) AND booking_id IN (
    SELECT b.id FROM bookings b 
    JOIN agents a ON b.agent_id = a.id 
    WHERE a.user_id = auth.uid()
  ))
);
```

---

## Files to Modify

| File | Change |
|------|--------|
| Database Migration | Update `view_transcription` policy to use `has_role()` instead of `get_my_role()` |

No frontend changes needed - the `useMyBookingsData` hook and `ContactProfileHoverCard` are already correctly implemented.

---

## Why This Works

The `has_role()` function:
- Takes explicit parameters (`user_id`, `role`)
- Is a `SECURITY DEFINER` function that executes with elevated privileges
- Works correctly in all query contexts including embedded relations

The `get_my_role()` function:
- Uses `auth.uid()` internally
- Can fail or return NULL during nested query evaluation
- Not reliable for embedded relation queries

---

## Expected Outcome

After this fix:
1. Agents will see full call insights (budget, timeline, concerns, preferences) in hover cards on the My Bookings page
2. The transcription data will be properly joined when the agent fetches their bookings
3. No changes needed to frontend code - the existing implementation will work correctly once the data is returned

---

## Verification

After deployment, log in as agent "Megane Boileau" and verify:
- Hover over "Dale Campbell" or any other booking with completed transcription
- The hover card should show Budget & Timeline, Looking For, and Concerns sections instead of "No contact insights"
