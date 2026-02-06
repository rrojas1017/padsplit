-- Create a function that triggers auto-transcription check via pg_net
CREATE OR REPLACE FUNCTION public.trigger_auto_transcription_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  -- Only trigger if the booking has a kixie_link and hasn't been transcribed
  IF NEW.kixie_link IS NOT NULL AND (NEW.transcription_status IS NULL OR NEW.transcription_status = 'failed') THEN
    -- Get the Supabase URL from environment (set via vault or config)
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_key := current_setting('app.settings.service_role_key', true);
    
    -- If settings not available, use direct URL (fallback)
    IF supabase_url IS NULL OR supabase_url = '' THEN
      supabase_url := 'https://qwddqoyewtozzdvfmavn.supabase.co';
    END IF;
    
    -- Queue the HTTP request to check-auto-transcription function
    -- Using pg_net for async HTTP calls
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/check-auto-transcription',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_key, current_setting('supabase.service_role_key', true))
      ),
      body := jsonb_build_object('bookingId', NEW.id)
    );
    
    RAISE LOG '[auto-transcription-trigger] Queued transcription check for booking %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger that fires AFTER INSERT on bookings
DROP TRIGGER IF EXISTS trigger_auto_transcription ON public.bookings;

CREATE TRIGGER trigger_auto_transcription
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_transcription_on_insert();

-- Also create a trigger for UPDATE (in case kixie_link is added later)
CREATE OR REPLACE FUNCTION public.trigger_auto_transcription_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  -- Only trigger if kixie_link was just added (was null, now has value) and not yet transcribed
  IF OLD.kixie_link IS NULL 
     AND NEW.kixie_link IS NOT NULL 
     AND (NEW.transcription_status IS NULL OR NEW.transcription_status = 'failed') THEN
    
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_key := current_setting('app.settings.service_role_key', true);
    
    IF supabase_url IS NULL OR supabase_url = '' THEN
      supabase_url := 'https://qwddqoyewtozzdvfmavn.supabase.co';
    END IF;
    
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/check-auto-transcription',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_key, current_setting('supabase.service_role_key', true))
      ),
      body := jsonb_build_object('bookingId', NEW.id)
    );
    
    RAISE LOG '[auto-transcription-trigger] Queued transcription check for updated booking %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_transcription_update ON public.bookings;

CREATE TRIGGER trigger_auto_transcription_update
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_transcription_on_update();

-- Grant execute on net.http_post for the trigger functions
GRANT USAGE ON SCHEMA net TO postgres, service_role;