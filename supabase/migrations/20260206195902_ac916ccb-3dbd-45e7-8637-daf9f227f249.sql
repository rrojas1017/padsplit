-- Create IP allowlists table for agent login restrictions
CREATE TABLE public.ip_allowlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE public.ip_allowlists IS 'Stores allowed IP addresses for agent login restrictions. site_id NULL means global allowlist.';
COMMENT ON COLUMN public.ip_allowlists.ip_address IS 'Single IP address or CIDR range (e.g., 192.168.1.0/24)';

-- Create index for faster lookups
CREATE INDEX idx_ip_allowlists_site_id ON public.ip_allowlists(site_id);
CREATE INDEX idx_ip_allowlists_is_active ON public.ip_allowlists(is_active);

-- Enable Row Level Security
ALTER TABLE public.ip_allowlists ENABLE ROW LEVEL SECURITY;

-- RLS Policy: super_admin and admin can view all entries
CREATE POLICY "Super admins and admins can view all IP allowlists"
ON public.ip_allowlists
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- RLS Policy: supervisors can view entries for their site only
CREATE POLICY "Supervisors can view IP allowlists for their site"
ON public.ip_allowlists
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'supervisor'
    AND (ip_allowlists.site_id = p.site_id OR ip_allowlists.site_id IS NULL)
  )
);

-- RLS Policy: only super_admin and admin can insert
CREATE POLICY "Super admins and admins can insert IP allowlists"
ON public.ip_allowlists
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- RLS Policy: only super_admin and admin can update
CREATE POLICY "Super admins and admins can update IP allowlists"
ON public.ip_allowlists
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- RLS Policy: only super_admin and admin can delete
CREATE POLICY "Super admins and admins can delete IP allowlists"
ON public.ip_allowlists
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);