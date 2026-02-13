
-- Add detected_issues column to bookings table
ALTER TABLE public.bookings ADD COLUMN detected_issues text[] DEFAULT NULL;

-- Add GIN index for efficient array overlap queries
CREATE INDEX idx_bookings_detected_issues ON public.bookings USING GIN(detected_issues);
