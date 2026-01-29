-- Add import_batch_id column to track historical imports
ALTER TABLE bookings 
ADD COLUMN import_batch_id TEXT DEFAULT NULL;

-- Create partial index for efficient batch lookups
CREATE INDEX idx_bookings_import_batch ON bookings(import_batch_id) 
WHERE import_batch_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN bookings.import_batch_id IS 'Tracks which historical import batch this record belongs to. Format: IMPORT-YYYYMMDD-HHMMSS';