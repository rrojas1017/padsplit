-- Add performance indexes for Reports page server-side pagination
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date_desc 
ON bookings(booking_date DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_import_batch 
ON bookings(import_batch_id) WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_agent_booking_date 
ON bookings(agent_id, booking_date DESC);