
-- Fix search_path for the validation function
ALTER FUNCTION public.validate_manual_booking_contacts() SET search_path = public;
