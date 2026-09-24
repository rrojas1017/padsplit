-- Captures public.agent_goals, which exists in the hosted DB but was never created by a migration.
-- Backdated so that 20251207011758_* (which alters agent_goals) succeeds on a fresh database.
-- Idempotent: a no-op on production.
CREATE TABLE IF NOT EXISTS public.agent_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  daily_target integer NOT NULL DEFAULT 3,
  weekly_target integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_goals ENABLE ROW LEVEL SECURITY;
