

# Fix Member Data Tab — Missing Foreign Key

## Problem
The Member Data tab shows 0 records despite 599 records existing in the database. The Supabase JS query uses `bookings!inner(member_name, contact_phone)` to join `booking_transcriptions` with `bookings`, but there is **no foreign key constraint** between these tables. PostgREST requires a FK relationship to perform embedded joins — without it, the query silently fails and returns empty results.

## Solution
Two changes needed:

### 1. Add FK constraint via migration
```sql
ALTER TABLE booking_transcriptions
ADD CONSTRAINT booking_transcriptions_booking_id_fkey
FOREIGN KEY (booking_id) REFERENCES bookings(id);
```
This lets PostgREST resolve the `bookings!inner(...)` join.

### 2. Fallback: Also update the query approach
As a safety net, modify `MemberDataTab.tsx` to handle the case where the join might not return `member_name` — the component already has fallback logic (`b?.member_name || ext?.member_name`), so this is already covered. No code changes needed beyond the migration.

## Files
| File | Action |
|------|--------|
| New migration | Add FK constraint on `booking_transcriptions.booking_id → bookings.id` |

