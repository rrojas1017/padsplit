

## Fix: Vici API Submissions Failing

### Problem
Every submission from Vici Dial is being rejected. The `bookings` table has a CHECK constraint that only allows `booking_type` values of `Inbound`, `Outbound`, or `Referral`. The `submit-conversation-audio` edge function inserts `booking_type: 'Research'`, which violates this constraint.

All recent submissions (visible in logs) are failing with:
> `new row for relation "bookings" violates check constraint "bookings_booking_type_check"`

### Fix
**Database migration**: Update the CHECK constraint to include `'Research'` as an allowed `booking_type` value.

```sql
ALTER TABLE public.bookings DROP CONSTRAINT bookings_booking_type_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_booking_type_check
  CHECK (booking_type = ANY (ARRAY['Inbound','Outbound','Referral','Research']));
```

No code changes needed -- the edge function is already correctly inserting `'Research'`. This is purely a database constraint issue.

