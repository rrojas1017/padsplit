-- Add column to track backfill processing
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS market_backfill_checked boolean DEFAULT false;