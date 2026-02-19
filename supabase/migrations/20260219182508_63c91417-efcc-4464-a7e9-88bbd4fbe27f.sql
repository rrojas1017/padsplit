
-- Create api_credentials table
CREATE TABLE public.api_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_name TEXT NOT NULL,
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  rate_limit INTEGER,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies using has_role() to avoid recursion
CREATE POLICY "Admins can view non-deleted api_credentials"
ON public.api_credentials
FOR SELECT
USING (
  (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND deleted_at IS NULL
);

CREATE POLICY "Admins can insert api_credentials"
ON public.api_credentials
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update api_credentials"
ON public.api_credentials
FOR UPDATE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete api_credentials"
ON public.api_credentials
FOR DELETE
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_api_credentials_updated_at
BEFORE UPDATE ON public.api_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
