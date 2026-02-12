
-- Add record_type column to distinguish booking vs research records
ALTER TABLE public.bookings ADD COLUMN record_type text NOT NULL DEFAULT 'booking';

-- Add FK to research_calls for drill-down
ALTER TABLE public.bookings ADD COLUMN research_call_id uuid REFERENCES public.research_calls(id);

-- Index for efficient filtering
CREATE INDEX idx_bookings_record_type ON public.bookings (record_type);

-- Update the validation trigger to skip research records
CREATE OR REPLACE FUNCTION public.validate_manual_booking_contacts()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip validation for research records and imported records
  IF NEW.record_type = 'research' THEN
    RETURN NEW;
  END IF;

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
  IF TG_OP = 'UPDATE' AND NEW.import_batch_id IS NULL AND NEW.record_type != 'research' THEN
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
$$ LANGUAGE plpgsql;
