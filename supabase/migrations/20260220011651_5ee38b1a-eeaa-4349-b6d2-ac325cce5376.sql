
-- Create trigger function that fires net.http_post when status changes to 'Moved In'
CREATE OR REPLACE FUNCTION public.trigger_notify_moved_in()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'Moved In' AND OLD.status IS DISTINCT FROM 'Moved In' THEN
    PERFORM net.http_post(
      'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/notify-moved-in',
      jsonb_build_object('bookingId', NEW.id),
      jsonb_build_object('Content-Type', 'application/json')
    );
    RAISE LOG '[Trigger] Fired notify-moved-in for booking % (status -> Moved In)', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO 'public';

-- Create trigger on bookings table
CREATE TRIGGER on_booking_moved_in
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_moved_in();
