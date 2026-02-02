-- Fix search path for the validation function
CREATE OR REPLACE FUNCTION validate_manual_booking_contacts()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only validate on INSERT for manual entries (no import batch)
  IF TG_OP = 'INSERT' AND NEW.import_batch_id IS NULL THEN
    IF NEW.contact_email IS NULL OR TRIM(NEW.contact_email) = '' THEN
      RAISE EXCEPTION 'Contact email is required for manual bookings';
    END IF;
    
    IF NEW.contact_phone IS NULL OR TRIM(NEW.contact_phone) = '' THEN
      RAISE EXCEPTION 'Contact phone is required for manual bookings';
    END IF;
  END IF;
  
  -- On UPDATE, only validate if contact fields are being changed to empty
  IF TG_OP = 'UPDATE' AND NEW.import_batch_id IS NULL THEN
    IF OLD.contact_email IS DISTINCT FROM NEW.contact_email THEN
      IF NEW.contact_email IS NULL OR TRIM(NEW.contact_email) = '' THEN
        RAISE EXCEPTION 'Contact email is required for manual bookings';
      END IF;
    END IF;
    
    IF OLD.contact_phone IS DISTINCT FROM NEW.contact_phone THEN
      IF NEW.contact_phone IS NULL OR TRIM(NEW.contact_phone) = '' THEN
        RAISE EXCEPTION 'Contact phone is required for manual bookings';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;