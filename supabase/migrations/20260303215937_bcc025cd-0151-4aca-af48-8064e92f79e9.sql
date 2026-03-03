ALTER TABLE public.bookings DROP CONSTRAINT bookings_booking_type_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_booking_type_check
  CHECK (booking_type = ANY (ARRAY['Inbound','Outbound','Referral','Research']));