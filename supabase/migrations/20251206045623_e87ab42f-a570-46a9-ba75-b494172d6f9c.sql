-- Create qa_settings table for configurable QA rubrics
CREATE TABLE public.qa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'PadSplit QA Rubric',
  categories JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qa_settings ENABLE ROW LEVEL SECURITY;

-- Admin/Super Admin can manage qa_settings
CREATE POLICY "Admins can manage qa_settings"
ON public.qa_settings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view active qa_settings (needed for edge functions)
CREATE POLICY "Authenticated users can view active qa_settings"
ON public.qa_settings
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Insert default PadSplit rubric with exact weights (10+15+20+15+20+10=90)
INSERT INTO public.qa_settings (name, categories, is_active) VALUES (
  'PadSplit QA Rubric',
  '[
    {"name": "Greeting & Introduction", "maxPoints": 10, "criteria": "Professional greeting, friendly tone, identifies company and self, offers help clearly"},
    {"name": "Needs Discovery", "maxPoints": 15, "criteria": "Asks about preferred location, budget constraints, move-in timeline, current housing situation"},
    {"name": "Clarity & Product Knowledge", "maxPoints": 20, "criteria": "Explains PadSplit model clearly, describes room types, pricing structure, member benefits, application process"},
    {"name": "Handling Objections", "maxPoints": 15, "criteria": "Listens actively, acknowledges concerns, provides relevant solutions, maintains positive tone"},
    {"name": "Booking Support / CTA", "maxPoints": 20, "criteria": "Provides clear guidance on booking process, next steps, follow-up actions, creates urgency appropriately"},
    {"name": "Soft Skills & Tone", "maxPoints": 10, "criteria": "Maintains positive energy, shows empathy, speaks respectfully, adapts communication style to caller"}
  ]'::jsonb,
  true
);

-- Add qa_scores column to booking_transcriptions
ALTER TABLE public.booking_transcriptions 
ADD COLUMN qa_scores JSONB;

-- Add trigger for updated_at on qa_settings
CREATE TRIGGER update_qa_settings_updated_at
BEFORE UPDATE ON public.qa_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();