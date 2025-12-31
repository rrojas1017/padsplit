-- Create admin_notifications table for billing alerts and system notifications
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  service text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  is_read boolean DEFAULT false,
  is_resolved boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admins can view all notifications
CREATE POLICY "Admins can view admin_notifications"
ON public.admin_notifications
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Admins can update notifications (mark as read/resolved)
CREATE POLICY "Admins can update admin_notifications"
ON public.admin_notifications
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Super admin can delete notifications
CREATE POLICY "Super admin can delete admin_notifications"
ON public.admin_notifications
FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Add index for common queries
CREATE INDEX idx_admin_notifications_unresolved ON public.admin_notifications (is_resolved, created_at DESC) WHERE is_resolved = false;