
# Auto-Email on "Moved In" Status Change

## What This Does

Every time a booking's status is changed from "Pending Move-In" to "Moved In" — whether via the Edit Booking form or the quick "Mark as Moved In" button in Reports — the system will automatically send an email to a configured destination address containing the full record details: member name, contact email, phone, agent, market, booking date, move-in date, notes, HubSpot link, Kixie link, and Admin Profile link.

---

## How It Works (Architecture)

The trigger point is a **database-level trigger** (the most reliable approach — it fires regardless of which part of the UI made the change):

```text
User changes status → bookings table UPDATE → DB Trigger fires → Edge Function called → SendGrid email sent
```

This means it works automatically whether the status is changed from:
- The Edit Booking page
- The "Mark as Moved In" dropdown in Reports
- Any future code path that updates the bookings table

---

## Technical Plan

### 1. New Edge Function: `notify-moved-in`

A new backend function that:
- Receives a `bookingId` from the database trigger
- Fetches the full booking record from the database (member name, email, phone, agent name, market, dates, notes, all links)
- Builds a formatted HTML email with all record details
- Sends it via SendGrid to the configured destination email address
- Logs the outcome

**Email contents will include:**
- Member Name
- Contact Email & Phone
- Agent Name
- Market (City, State)
- Booking Date & Move-In Date
- Booking Type & Communication Method
- Notes
- HubSpot Link, Kixie Recording Link, Admin Profile Link
- Timestamp of when the status changed

### 2. New Database Trigger: `on_booking_moved_in`

A PostgreSQL trigger that fires `AFTER UPDATE` on the `bookings` table, specifically when `status` changes TO `'Moved In'`. It uses `net.http_post` to call the new edge function (same pattern as the existing `trigger_auto_transcription_on_update` trigger already in the codebase).

```sql
-- Fires only when: old status != 'Moved In' AND new status = 'Moved In'
CREATE OR REPLACE FUNCTION public.trigger_notify_moved_in()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'Moved In' AND OLD.status IS DISTINCT FROM 'Moved In' THEN
    PERFORM net.http_post(
      'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/notify-moved-in',
      jsonb_build_object('bookingId', NEW.id),
      jsonb_build_object('Content-Type', 'application/json')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO 'public';
```

### 3. Configuration: Destination Email Address

The destination email will be stored as a **backend secret** (`MOVED_IN_NOTIFICATION_EMAIL`) so it can be changed without touching code. You will be prompted to enter the email address during implementation.

The `supabase/config.toml` will have `verify_jwt = false` added for the new function (it's called by the DB trigger, not a browser user).

---

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/notify-moved-in/index.ts` | New edge function |
| `supabase/config.toml` | Add `[functions.notify-moved-in]` with `verify_jwt = false` |
| Database migration | Add trigger function + trigger on `bookings` table |

No frontend files need to change — the trigger is invisible to the UI.

---

## Email Format Preview

The email sent will look like this:

```
Subject: [Moved In] Ramon Rojas — ATL, GA

Member Name:       Ramon Rojas
Contact Email:     ramon.rojas@gmail.com
Contact Phone:     678-463-1178
Agent:             Maria Garcia
Market:            Atlanta, GA
Booking Date:      Feb 15, 2026
Move-In Date:      Feb 20, 2026
Booking Type:      Inbound
Communication:     Phone
Notes:             Member confirmed. First payment ready.
HubSpot:           https://app.hubspot.com/...
Kixie Recording:   https://kixie.com/...
Admin Profile:     https://admin.padsplit.com/...
Status Changed:    Feb 20, 2026 at 3:42 PM
```

---

## No Changes Needed To

- `BookingsContext.tsx` — trigger fires at DB level, not app level
- `EditBooking.tsx` — no changes
- `Reports.tsx` — no changes
- Any existing RLS policies — edge function uses service role key (same as other notification functions)
