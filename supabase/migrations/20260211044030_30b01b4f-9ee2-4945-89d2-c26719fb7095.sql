-- Normalize market_city: trim, strip neighborhood prefix (keep last part after comma), then title case
UPDATE bookings
SET market_city = initcap(trim(
  CASE 
    WHEN market_city LIKE '%,%' THEN trim(substring(market_city from '[^,]+$'))
    ELSE market_city
  END
))
WHERE market_city IS NOT NULL;

-- Normalize market_state: trim and title case
UPDATE bookings
SET market_state = initcap(trim(market_state))
WHERE market_state IS NOT NULL;