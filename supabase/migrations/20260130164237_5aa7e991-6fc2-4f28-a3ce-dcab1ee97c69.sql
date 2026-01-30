-- Create validation function for manual booking contacts
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger on bookings table
CREATE TRIGGER enforce_manual_booking_contacts
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_manual_booking_contacts();