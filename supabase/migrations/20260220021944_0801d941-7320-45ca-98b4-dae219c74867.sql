
CREATE OR REPLACE FUNCTION public.get_daily_coaching_gate()
 RETURNS TABLE(is_blocked boolean, today_avg numeric, record_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today_start timestamptz;
  v_today_avg numeric;
  v_count integer;
  MIN_RECORDS constant integer := 3;
  THRESHOLD constant numeric := 0.07;
BEGIN
  v_today_start := date_trunc('day', now() AT TIME ZONE 'UTC');

  SELECT
    COALESCE(SUM(c.estimated_cost_usd) / NULLIF(COUNT(DISTINCT c.booking_id), 0), 0),
    COALESCE(COUNT(DISTINCT c.booking_id)::integer, 0)
  INTO v_today_avg, v_count
  FROM api_costs c
  JOIN bookings b ON b.id = c.booking_id
  WHERE c.is_internal = false
    AND c.service_type NOT LIKE 'tts_%'
    AND c.booking_id IS NOT NULL
    AND c.created_at >= v_today_start
    AND b.record_type != 'research';

  RETURN QUERY SELECT
    (COALESCE(v_count, 0) >= MIN_RECORDS AND COALESCE(v_today_avg, 0) > THRESHOLD) AS is_blocked,
    COALESCE(v_today_avg, 0::numeric) AS today_avg,
    COALESCE(v_count, 0) AS record_count;
END;
$function$
