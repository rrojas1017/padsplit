-- Add email verification columns to bookings table
ALTER TABLE public.bookings
ADD COLUMN email_verified boolean DEFAULT NULL,
ADD COLUMN email_verified_at timestamptz DEFAULT NULL,
ADD COLUMN email_verification_status text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.bookings.email_verified IS 'null = not checked, true = valid, false = invalid';
COMMENT ON COLUMN public.bookings.email_verified_at IS 'Timestamp when email verification was performed';
COMMENT ON COLUMN public.bookings.email_verification_status IS 'Detailed status: valid, invalid, catch_all, disposable, unknown';