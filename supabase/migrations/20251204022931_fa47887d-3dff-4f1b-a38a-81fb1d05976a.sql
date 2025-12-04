-- Create table to track display token views
CREATE TABLE public.display_token_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES public.display_tokens(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Index for fast queries by token
CREATE INDEX idx_display_token_views_token_id ON public.display_token_views(token_id);
CREATE INDEX idx_display_token_views_viewed_at ON public.display_token_views(viewed_at);

-- Enable RLS
ALTER TABLE public.display_token_views ENABLE ROW LEVEL SECURITY;

-- Only admins can view access logs
CREATE POLICY "Admins can view display token views" ON public.display_token_views
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  );