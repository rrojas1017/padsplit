-- Capture only — applied by direct SQL on 2026-10-06 (drift #52). Do not run.
ALTER TABLE public.research_scripts ADD COLUMN IF NOT EXISTS call_outcomes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.research_scripts ADD CONSTRAINT research_scripts_call_outcomes_check CHECK (jsonb_typeof(call_outcomes) = 'array' AND jsonb_array_length(call_outcomes) <= 20);
ALTER TABLE public.research_calls ADD COLUMN IF NOT EXISTS close_outcome_id text, ADD COLUMN IF NOT EXISTS close_outcome_label text;
ALTER TABLE public.research_calls ADD CONSTRAINT research_calls_close_outcome_len_check CHECK ((close_outcome_id IS NULL OR char_length(close_outcome_id) <= 64) AND (close_outcome_label IS NULL OR char_length(close_outcome_label) <= 120));
