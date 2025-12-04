-- Add call duration column to bookings table
ALTER TABLE public.bookings ADD COLUMN call_duration_seconds integer;