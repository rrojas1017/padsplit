ALTER TABLE public.research_scripts 
ADD COLUMN IF NOT EXISTS intro_script_es text,
ADD COLUMN IF NOT EXISTS closing_script_es text,
ADD COLUMN IF NOT EXISTS rebuttal_script_es text,
ADD COLUMN IF NOT EXISTS questions_es jsonb,
ADD COLUMN IF NOT EXISTS translation_status text DEFAULT 'pending';