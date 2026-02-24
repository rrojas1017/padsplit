CREATE OR REPLACE FUNCTION public.claim_booking_for_transcription(p_booking_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  UPDATE bookings
  SET transcription_status = 'queued'
  WHERE id = p_booking_id
    AND (transcription_status IS NULL OR transcription_status IN ('failed', 'pending'))
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$function$;