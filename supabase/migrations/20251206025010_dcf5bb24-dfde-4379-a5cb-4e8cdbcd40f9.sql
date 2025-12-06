-- Fast role check function
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1 $$;

-- Fast site_id lookup
CREATE OR REPLACE FUNCTION public.get_my_site_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT site_id FROM public.profiles WHERE id = auth.uid() LIMIT 1 $$;

-- Create separate table for heavy transcription data
CREATE TABLE public.booking_transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  call_transcription text,
  call_summary text,
  call_key_points jsonb,
  agent_feedback jsonb,
  coaching_audio_url text,
  coaching_audio_generated_at timestamptz,
  coaching_audio_regenerated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_booking_transcriptions_booking_id ON public.booking_transcriptions(booking_id);

-- Enable RLS
ALTER TABLE public.booking_transcriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies using efficient helper functions
CREATE POLICY "view_transcription" ON public.booking_transcriptions
FOR SELECT USING (
  get_my_role() IN ('super_admin', 'admin')
  OR (get_my_role() = 'supervisor' AND booking_id IN (
    SELECT b.id FROM bookings b JOIN agents a ON b.agent_id = a.id WHERE a.site_id = get_my_site_id()
  ))
  OR (get_my_role() = 'agent' AND booking_id IN (
    SELECT b.id FROM bookings b JOIN agents a ON b.agent_id = a.id WHERE a.user_id = auth.uid()
  ))
);

CREATE POLICY "insert_transcription" ON public.booking_transcriptions
FOR INSERT WITH CHECK (get_my_role() IN ('super_admin', 'admin', 'supervisor'));

CREATE POLICY "update_transcription" ON public.booking_transcriptions
FOR UPDATE USING (get_my_role() IN ('super_admin', 'admin', 'supervisor'));

-- Migrate existing data to new table
INSERT INTO public.booking_transcriptions (
  booking_id, call_transcription, call_summary, call_key_points,
  agent_feedback, coaching_audio_url, coaching_audio_generated_at, coaching_audio_regenerated_at
)
SELECT 
  id, call_transcription, call_summary, call_key_points,
  agent_feedback, coaching_audio_url, coaching_audio_generated_at, coaching_audio_regenerated_at
FROM public.bookings
WHERE call_transcription IS NOT NULL OR agent_feedback IS NOT NULL OR coaching_audio_url IS NOT NULL;

-- Clear heavy columns from main bookings table to reduce size
UPDATE public.bookings SET
  call_transcription = NULL,
  call_summary = NULL,
  call_key_points = NULL,
  agent_feedback = NULL,
  coaching_audio_url = NULL,
  coaching_audio_generated_at = NULL,
  coaching_audio_regenerated_at = NULL
WHERE call_transcription IS NOT NULL OR agent_feedback IS NOT NULL OR coaching_audio_url IS NOT NULL;