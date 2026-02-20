
## Updated Plan: Auto-Email on "Moved In" — Trimmed Email Fields

### What Changes

The email format is being updated based on your feedback. The last 5 fields are removed. The email will stop at **Communication Method**.

**Fields included in the email (7 total):**

| # | Field | Source Column |
|---|---|---|
| 1 | Member Name | `member_name` |
| 2 | Contact Email | `contact_email` |
| 3 | Contact Phone | `contact_phone` |
| 4 | Agent | joined from `agents` table |
| 5 | Market | `market_city`, `market_state` |
| 6 | Booking Date | `booking_date` |
| 7 | Communication Method | `communication_method` |

**Fields removed (compared to original plan):**
- Notes
- HubSpot Link
- Kixie Recording Link
- Admin Profile Link
- Status Changed timestamp

---

### Updated Email Preview

```
Subject: [Moved In] Ramon Rojas — Atlanta, GA

Member Name:          Ramon Rojas
Contact Email:        ramon.rojas@gmail.com
Contact Phone:        678-463-1178
Agent:                Maria Garcia
Market:               Atlanta, GA
Booking Date:         Feb 15, 2026
Communication:        Phone
```

Clean, concise, and focused on the contact and context details only.

---

### Implementation (unchanged architecture, updated content only)

**1. Edge Function — `supabase/functions/notify-moved-in/index.ts` (new file)**

- Called by the database trigger (no JWT required — `verify_jwt = false`)
- Uses the service role key to fetch the full booking record + agent name via a join
- Builds the 7-field HTML email
- Sends via SendGrid (`SENDGRID_API_KEY` already configured as a secret)
- Destination address read from `MOVED_IN_NOTIFICATION_EMAIL` secret

**2. `supabase/config.toml` — add entry**

```toml
[functions.notify-moved-in]
verify_jwt = false
```

**3. Database Migration — new trigger**

Follows the exact same pattern as the existing `trigger_auto_transcription_on_update` function already in the codebase:

```sql
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

CREATE TRIGGER on_booking_moved_in
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_moved_in();
```

**4. Secret needed before deployment**

You will need to provide the destination email address — the address that receives every "Moved In" notification. This will be stored securely as `MOVED_IN_NOTIFICATION_EMAIL`. You will be prompted to enter it when implementation begins.

---

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/notify-moved-in/index.ts` | New edge function (7-field email) |
| `supabase/config.toml` | Add `[functions.notify-moved-in]` entry |
| Database migration | Add trigger function + trigger on `bookings` |

No frontend files change. The trigger fires at the database level from any code path that updates the status to "Moved In".
