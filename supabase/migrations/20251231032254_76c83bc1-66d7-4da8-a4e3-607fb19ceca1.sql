-- Create promo_codes table for move-in calculator
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_amount numeric NOT NULL DEFAULT 0,
  discount_type text NOT NULL DEFAULT 'fixed',
  valid_from date,
  valid_until date,
  max_uses integer,
  current_uses integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Admins can manage promo codes
CREATE POLICY "Admins can manage promo_codes"
  ON public.promo_codes FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view active promo codes
CREATE POLICY "Authenticated users can view active promo_codes"
  ON public.promo_codes FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- Add trigger for updated_at
CREATE TRIGGER update_promo_codes_updated_at
  BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();