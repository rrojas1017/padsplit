ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status = ANY (ARRAY['Pending Move-In','Moved In','Member Rejected','No Show','Cancelled','Non Booking','Research']));