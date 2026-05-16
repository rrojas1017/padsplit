DELETE FROM research_calls
WHERE id IN (
  SELECT rc.id FROM research_calls rc
  WHERE rc.campaign_id = '2bff3835-53b4-4c19-bf72-19f3a7298380'
    AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.research_call_id = rc.id)
  LIMIT 3000
);