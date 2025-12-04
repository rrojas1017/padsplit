-- Enable realtime for bookings table to support transcription status polling
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;