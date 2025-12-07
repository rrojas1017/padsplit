
-- Add missing columns to agent_goals table for period-based goal tracking
ALTER TABLE public.agent_goals 
ADD COLUMN IF NOT EXISTS week_start date,
ADD COLUMN IF NOT EXISTS week_end date,
ADD COLUMN IF NOT EXISTS set_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS notes text;

-- Create unique constraint on agent_id + week_start to prevent duplicate goals for same week
ALTER TABLE public.agent_goals 
DROP CONSTRAINT IF EXISTS agent_goals_agent_week_unique;

ALTER TABLE public.agent_goals 
ADD CONSTRAINT agent_goals_agent_week_unique UNIQUE (agent_id, week_start);

-- Update RLS policies to allow admin/super_admin read access
DROP POLICY IF EXISTS "Admins can manage all goals" ON public.agent_goals;
DROP POLICY IF EXISTS "Supervisors can manage goals in their site" ON public.agent_goals;
DROP POLICY IF EXISTS "Agents can view their own goals" ON public.agent_goals;

-- Agents can view their own goals
CREATE POLICY "Agents can view their own goals" 
ON public.agent_goals 
FOR SELECT 
USING (
  agent_id IN (
    SELECT id FROM agents WHERE user_id = auth.uid()
  )
);

-- Supervisors can manage goals for agents in their site
CREATE POLICY "Supervisors can manage goals in their site" 
ON public.agent_goals 
FOR ALL 
USING (
  has_role(auth.uid(), 'supervisor'::app_role) AND 
  agent_id IN (
    SELECT id FROM agents WHERE site_id = get_user_site_id(auth.uid())
  )
);

-- Admins and super_admins can view all goals (read-only for admins)
CREATE POLICY "Admins can view all goals" 
ON public.agent_goals 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Super admins can manage all goals
CREATE POLICY "Super admins can manage all goals" 
ON public.agent_goals 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
);
