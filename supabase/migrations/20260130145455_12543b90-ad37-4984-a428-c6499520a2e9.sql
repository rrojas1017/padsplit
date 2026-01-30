-- Add communication permission to profiles
ALTER TABLE public.profiles 
ADD COLUMN can_send_communications BOOLEAN NOT NULL DEFAULT false;

-- Create contact communications tracking table
CREATE TABLE public.contact_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  user_name TEXT NOT NULL,
  communication_type TEXT NOT NULL CHECK (communication_type IN ('sms', 'email')),
  recipient_email TEXT,
  recipient_phone TEXT,
  message_preview TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_communications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contact_communications
CREATE POLICY "Users can view communications they sent"
ON public.contact_communications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all communications"
ON public.contact_communications FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authorized users can insert communications"
ON public.contact_communications FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND can_send_communications = true
  )
);

-- Index for faster lookups
CREATE INDEX idx_contact_communications_booking_id ON public.contact_communications(booking_id);
CREATE INDEX idx_contact_communications_user_id ON public.contact_communications(user_id);
CREATE INDEX idx_contact_communications_sent_at ON public.contact_communications(sent_at DESC);