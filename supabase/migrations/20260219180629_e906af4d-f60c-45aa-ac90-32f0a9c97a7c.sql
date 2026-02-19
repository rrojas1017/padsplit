
CREATE TABLE public.script_access_tokens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id        uuid NOT NULL REFERENCES public.research_scripts(id) ON DELETE CASCADE,
  token            text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  label            text,
  is_active        boolean NOT NULL DEFAULT true,
  expires_at       timestamptz,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.script_access_tokens ENABLE ROW LEVEL SECURITY;

-- Admins / super_admins: full CRUD
CREATE POLICY "Admins can manage script_access_tokens"
  ON public.script_access_tokens
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = ANY (ARRAY['super_admin'::app_role, 'admin'::app_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = ANY (ARRAY['super_admin'::app_role, 'admin'::app_role])
    )
  );

-- Index for fast token lookups by the edge function
CREATE INDEX idx_script_access_tokens_token ON public.script_access_tokens (token);
CREATE INDEX idx_script_access_tokens_script_id ON public.script_access_tokens (script_id);
