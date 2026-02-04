-- Create bulk_processing_jobs table for tracking transcription job state
CREATE TABLE public.bulk_processing_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'stopped')),
  total_records INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  current_booking_id UUID,
  site_filter TEXT CHECK (site_filter IN ('vixicom_only', 'non_vixicom', 'all')),
  include_tts BOOLEAN NOT NULL DEFAULT true,
  pacing_seconds INTEGER NOT NULL DEFAULT 10,
  error_log JSONB[] DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bulk_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Super admins and admins can view all jobs
CREATE POLICY "Admins can view all bulk processing jobs"
  ON public.bulk_processing_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Super admins and admins can create jobs
CREATE POLICY "Admins can create bulk processing jobs"
  ON public.bulk_processing_jobs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Super admins and admins can update jobs
CREATE POLICY "Admins can update bulk processing jobs"
  ON public.bulk_processing_jobs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Super admins can delete jobs
CREATE POLICY "Super admins can delete bulk processing jobs"
  ON public.bulk_processing_jobs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Add index for quick status lookups
CREATE INDEX idx_bulk_processing_jobs_status ON public.bulk_processing_jobs(status);
CREATE INDEX idx_bulk_processing_jobs_created_at ON public.bulk_processing_jobs(created_at DESC);