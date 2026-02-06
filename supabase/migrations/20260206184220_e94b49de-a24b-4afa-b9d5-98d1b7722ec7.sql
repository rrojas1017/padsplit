-- Fix function search_path security warnings by explicitly setting search_path
CREATE OR REPLACE FUNCTION public.trigger_auto_transcription_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Only trigger if booking has a kixie_link and transcription hasn't been initiated
  IF NEW.kixie_link IS NOT NULL AND NEW.transcription_status IS NULL THEN
    -- Get environment values from settings
    supabase_url := current_setting('app.supabase_url', true) OR 'https://qwddqoyewtozzdvfmavn.supabase.co';
    service_role_key := current_setting('app.supabase_service_role_key', true) OR '';
    
    -- Queue transcription via pg_net HTTP POST
    PERFORM net.http_post(
      concat(supabase_url, '/functions/v1/check-auto-transcription'),
      jsonb_build_object('bookingId', NEW.id),
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', concat('Bearer ', service_role_key)
      )
    );
    
    RAISE LOG '[Trigger] Queued transcription for booking % (kixie_link present)', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.trigger_auto_transcription_on_update()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Trigger if kixie_link was added and transcription hasn't started yet
  IF NEW.kixie_link IS NOT NULL 
    AND OLD.kixie_link IS NULL 
    AND NEW.transcription_status IS NULL THEN
    
    supabase_url := current_setting('app.supabase_url', true) OR 'https://qwddqoyewtozzdvfmavn.supabase.co';
    service_role_key := current_setting('app.supabase_service_role_key', true) OR '';
    
    PERFORM net.http_post(
      concat(supabase_url, '/functions/v1/check-auto-transcription'),
      jsonb_build_object('bookingId', NEW.id),
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', concat('Bearer ', service_role_key)
      )
    );
    
    RAISE LOG '[Trigger] Queued transcription for booking % (kixie_link added via update)', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;