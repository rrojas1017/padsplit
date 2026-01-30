

# Database-Level Contact Validation for Manual Bookings

## Overview
Add a database trigger that enforces `contact_email` and `contact_phone` are required for all manually-created bookings, preventing agents from bypassing frontend validation through cached browsers or other means.

## What This Solves
- Agents like Anel can currently save bookings without contact info even though the frontend shows validation
- This happens when users have cached/old frontend code or if validation is somehow bypassed
- Database-level enforcement is the definitive solution - no way to bypass it

## Implementation

### Step 1: Create Database Trigger
Add a validation trigger on the `bookings` table that runs BEFORE INSERT and BEFORE UPDATE:

```text
┌─────────────────────────────────────────────────────────────┐
│                    Trigger Logic                            │
├─────────────────────────────────────────────────────────────┤
│ IF import_batch_id IS NULL (manual entry)                   │
│   AND (contact_email IS NULL OR contact_email = '')         │
│   OR (contact_phone IS NULL OR contact_phone = '')          │
│ THEN                                                        │
│   RAISE EXCEPTION 'Contact email and phone required'        │
│ END IF                                                      │
└─────────────────────────────────────────────────────────────┘
```

**Why a trigger instead of CHECK constraint?**
- Triggers allow conditional logic (only enforce for manual entries)
- CHECK constraints would affect imported records too, which may not always have contact info
- Triggers provide clearer error messages

### Step 2: Update Frontend Error Handling
Ensure the booking form properly catches and displays the database error if someone somehow bypasses client validation:
- Catch the specific error message from the trigger
- Display a user-friendly toast message

## Files Changed

| File | Change |
|------|--------|
| Database Migration | New trigger `validate_manual_booking_contacts` |
| `src/pages/AddBooking.tsx` | Minor update to error handling (optional) |

## Technical Details

The trigger will be created with this SQL:
```sql
CREATE OR REPLACE FUNCTION validate_manual_booking_contacts()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate manual entries (no import batch)
  IF NEW.import_batch_id IS NULL THEN
    IF NEW.contact_email IS NULL OR TRIM(NEW.contact_email) = '' THEN
      RAISE EXCEPTION 'Contact email is required for manual bookings';
    END IF;
    
    IF NEW.contact_phone IS NULL OR TRIM(NEW.contact_phone) = '' THEN
      RAISE EXCEPTION 'Contact phone is required for manual bookings';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_manual_booking_contacts
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_manual_booking_contacts();
```

## Testing
After implementation:
1. Test creating a booking without email/phone - should fail with clear error
2. Test that imported records (with batch ID) still work without contact info
3. Verify existing manual bookings can still be updated (only new inserts affected, or updates that try to clear the fields)

