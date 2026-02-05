-- Add chunk_count column to track processing segments
ALTER TABLE bulk_processing_jobs 
ADD COLUMN chunk_count INTEGER DEFAULT 0;