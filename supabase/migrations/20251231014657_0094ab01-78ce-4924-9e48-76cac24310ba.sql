-- Create coaching_quiz_results table
CREATE TABLE public.coaching_quiz_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz_type TEXT NOT NULL CHECK (quiz_type IN ('jeff_coaching', 'katty_qa')),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 1,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add columns to booking_transcriptions for quiz completion tracking
ALTER TABLE public.booking_transcriptions 
ADD COLUMN coaching_quiz_passed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN qa_coaching_quiz_passed_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on coaching_quiz_results
ALTER TABLE public.coaching_quiz_results ENABLE ROW LEVEL SECURITY;

-- Agents can view their own quiz results
CREATE POLICY "Agents can view own quiz results"
ON public.coaching_quiz_results
FOR SELECT
USING (user_id = auth.uid());

-- Agents can insert their own quiz results
CREATE POLICY "Agents can insert own quiz results"
ON public.coaching_quiz_results
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Agents can update their own quiz results (for retries)
CREATE POLICY "Agents can update own quiz results"
ON public.coaching_quiz_results
FOR UPDATE
USING (user_id = auth.uid());

-- Supervisors can view quiz results for agents in their site
CREATE POLICY "Supervisors can view site quiz results"
ON public.coaching_quiz_results
FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) AND 
  booking_id IN (
    SELECT b.id FROM bookings b
    JOIN agents a ON b.agent_id = a.id
    WHERE a.site_id = get_user_site_id(auth.uid())
  )
);

-- Admins can view all quiz results
CREATE POLICY "Admins can view all quiz results"
ON public.coaching_quiz_results
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_coaching_quiz_results_booking ON public.coaching_quiz_results(booking_id);
CREATE INDEX idx_coaching_quiz_results_user ON public.coaching_quiz_results(user_id);