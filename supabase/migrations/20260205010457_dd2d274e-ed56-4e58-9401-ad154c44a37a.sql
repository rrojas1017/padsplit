-- Add last_activity_at column for heartbeat tracking
ALTER TABLE bulk_processing_jobs 
ADD COLUMN last_activity_at TIMESTAMPTZ;