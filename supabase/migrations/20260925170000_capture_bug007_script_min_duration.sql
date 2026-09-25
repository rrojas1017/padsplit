-- Capture of drift #41 (BUG-007), applied directly on 2026-09-25.
ALTER TABLE public.research_scripts ADD COLUMN IF NOT EXISTS min_valid_duration_seconds integer NOT NULL DEFAULT 120;
ALTER TABLE public.research_scripts ADD CONSTRAINT research_scripts_min_valid_duration_check CHECK (min_valid_duration_seconds BETWEEN 15 AND 600);
UPDATE public.research_scripts SET min_valid_duration_seconds = 45 WHERE id = '827b23ef-3f35-4108-8462-468bf6cf7872';
UPDATE public.research_scripts SET min_valid_duration_seconds = 90 WHERE id = 'c24c5e6b-c7d8-43c6-86d5-affea47178bf';
