-- Ensure RLS is enabled on bookings table (idempotent - safe to run if already enabled)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Force RLS to apply to table owners as well (prevents bypass)
ALTER TABLE public.bookings FORCE ROW LEVEL SECURITY;