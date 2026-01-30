-- Create function to get non-booking stats with server-side aggregation
CREATE OR REPLACE FUNCTION get_non_booking_stats(
  start_date DATE DEFAULT NULL
)
RETURNS TABLE(
  total_calls BIGINT,
  transcribed_calls BIGINT,
  high_readiness_calls BIGINT,
  avg_duration_seconds NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_calls,
    COUNT(CASE WHEN transcription_status = 'completed' THEN 1 END)::BIGINT as transcribed_calls,
    COUNT(CASE WHEN call_duration_seconds > 300 THEN 1 END)::BIGINT as high_readiness_calls,
    COALESCE(AVG(CASE WHEN call_duration_seconds > 0 THEN call_duration_seconds END), 0)::NUMERIC as avg_duration_seconds
  FROM bookings
  WHERE status = 'Non Booking'
    AND (start_date IS NULL OR booking_date >= start_date);
END;
$$;

-- Create function to get non-booking trends with server-side aggregation
CREATE OR REPLACE FUNCTION get_non_booking_trends(
  start_date DATE,
  group_by_week BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  period_date DATE,
  non_bookings BIGINT,
  transcribed BIGINT,
  high_readiness BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF group_by_week THEN
    RETURN QUERY
    SELECT 
      date_trunc('week', booking_date::timestamp)::DATE as period_date,
      COUNT(*)::BIGINT as non_bookings,
      COUNT(CASE WHEN transcription_status = 'completed' THEN 1 END)::BIGINT as transcribed,
      COUNT(CASE WHEN call_duration_seconds > 300 THEN 1 END)::BIGINT as high_readiness
    FROM bookings
    WHERE status = 'Non Booking'
      AND booking_date >= start_date
    GROUP BY date_trunc('week', booking_date::timestamp)::DATE
    ORDER BY period_date ASC;
  ELSE
    RETURN QUERY
    SELECT 
      booking_date as period_date,
      COUNT(*)::BIGINT as non_bookings,
      COUNT(CASE WHEN transcription_status = 'completed' THEN 1 END)::BIGINT as transcribed,
      COUNT(CASE WHEN call_duration_seconds > 300 THEN 1 END)::BIGINT as high_readiness
    FROM bookings
    WHERE status = 'Non Booking'
      AND booking_date >= start_date
    GROUP BY booking_date
    ORDER BY booking_date ASC;
  END IF;
END;
$$;