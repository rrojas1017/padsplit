-- Fix trigger functions to use hardcoded URL and remove auth dependency
CREATE OR REPLACE FUNCTION public.trigger_auto_transcription_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger if booking has a kixie_link and transcription hasn't been initiated
  IF NEW.kixie_link IS NOT NULL AND NEW.transcription_status IS NULL THEN
    PERFORM net.http_post(
      'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/check-auto-transcription',
      jsonb_build_object('bookingId', NEW.id),
      jsonb_build_object('Content-Type', 'application/json')
    );
    
    RAISE LOG '[Trigger] Queued transcription for booking % (kixie_link present)', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_auto_transcription_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Trigger if kixie_link was added and transcription hasn't started yet
  IF NEW.kixie_link IS NOT NULL 
    AND OLD.kixie_link IS NULL 
    AND NEW.transcription_status IS NULL THEN
    
    PERFORM net.http_post(
      'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/check-auto-transcription',
      jsonb_build_object('bookingId', NEW.id),
      jsonb_build_object('Content-Type', 'application/json')
    );
    
    RAISE LOG '[Trigger] Queued transcription for booking % (kixie_link added via update)', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;