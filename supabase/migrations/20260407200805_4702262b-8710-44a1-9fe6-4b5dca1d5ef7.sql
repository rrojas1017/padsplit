
CREATE TABLE public.coaching_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_enforcement_enabled boolean NOT NULL DEFAULT true,
  reminder_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.coaching_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings
CREATE POLICY "Authenticated users can read coaching_settings"
  ON public.coaching_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update coaching_settings"
  ON public.coaching_settings FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Seed initial row
INSERT INTO public.coaching_settings (quiz_enforcement_enabled, reminder_enabled) VALUES (true, true);
