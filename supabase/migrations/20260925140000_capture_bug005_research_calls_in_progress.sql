-- Capture of drift #37 (BUG-005), applied directly on 2026-09-25.
ALTER TABLE public.research_calls DROP CONSTRAINT research_calls_call_outcome_check;
ALTER TABLE public.research_calls ADD CONSTRAINT research_calls_call_outcome_check CHECK ((call_outcome = ANY (ARRAY['completed'::text, 'no_answer'::text, 'refused'::text, 'callback_requested'::text, 'transferred'::text, 'caller_hung_up'::text, 'caller_stopped'::text, 'wrong_number'::text, 'technical_issue'::text, 'ended_early'::text, 'in_progress'::text]))) NOT VALID;
ALTER TABLE public.research_calls VALIDATE CONSTRAINT research_calls_call_outcome_check;
CREATE UNIQUE INDEX IF NOT EXISTS research_calls_submission_id_key ON public.research_calls ((responses->>'_submission_id')) WHERE (responses->>'_submission_id') IS NOT NULL;
