-- Create table for STT provider quality comparisons
CREATE TABLE public.stt_quality_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id),
  kixie_link TEXT NOT NULL,
  
  -- ElevenLabs results
  elevenlabs_transcription TEXT,
  elevenlabs_word_count INTEGER,
  elevenlabs_char_count INTEGER,
  elevenlabs_latency_ms INTEGER,
  elevenlabs_confidence NUMERIC(4,3),
  
  -- Deepgram results
  deepgram_transcription TEXT,
  deepgram_word_count INTEGER,
  deepgram_char_count INTEGER,
  deepgram_latency_ms INTEGER,
  deepgram_confidence NUMERIC(4,3),
  
  -- Metadata
  call_duration_seconds INTEGER,
  audio_file_size_mb NUMERIC(6,2),
  comparison_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stt_quality_comparisons ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and super_admins can view all comparisons
CREATE POLICY "Admins can view STT comparisons"
  ON public.stt_quality_comparisons
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Policy: Admins and super_admins can insert comparisons
CREATE POLICY "Admins can insert STT comparisons"
  ON public.stt_quality_comparisons
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Policy: Admins and super_admins can delete comparisons
CREATE POLICY "Admins can delete STT comparisons"
  ON public.stt_quality_comparisons
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Add index for faster lookups
CREATE INDEX idx_stt_comparisons_booking_id ON public.stt_quality_comparisons(booking_id);
CREATE INDEX idx_stt_comparisons_created_at ON public.stt_quality_comparisons(created_at DESC);