CREATE OR REPLACE FUNCTION get_import_batch_counts()
RETURNS TABLE (
  import_batch_id text,
  record_count bigint,
  imported_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.import_batch_id,
    COUNT(*)::bigint as record_count,
    MIN(b.created_at) as imported_at
  FROM bookings b
  WHERE b.import_batch_id IS NOT NULL
  GROUP BY b.import_batch_id
  ORDER BY MIN(b.created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;