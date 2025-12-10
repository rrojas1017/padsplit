-- Add rebooking tracking fields to bookings table
ALTER TABLE public.bookings 
ADD COLUMN is_rebooking boolean NOT NULL DEFAULT false,
ADD COLUMN original_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

-- Create index for efficient rebooking queries
CREATE INDEX idx_bookings_is_rebooking ON public.bookings(is_rebooking) WHERE is_rebooking = true;
CREATE INDEX idx_bookings_original_booking_id ON public.bookings(original_booking_id) WHERE original_booking_id IS NOT NULL;