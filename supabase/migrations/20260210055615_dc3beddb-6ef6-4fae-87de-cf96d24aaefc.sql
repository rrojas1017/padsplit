
-- 1. Create sow_pricing_config table
CREATE TABLE public.sow_pricing_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_category TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  base_rate NUMERIC(10,6) NOT NULL,
  volume_tier_1_threshold INTEGER,
  volume_tier_1_rate NUMERIC(10,6),
  unit TEXT NOT NULL DEFAULT 'per_record',
  is_optional BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sow_pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage SOW pricing" ON public.sow_pricing_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Seed with SOW pricing
INSERT INTO public.sow_pricing_config (service_category, description, base_rate, volume_tier_1_threshold, volume_tier_1_rate, unit, is_optional) VALUES
  ('voice_processing', 'AI Processing - Voice-Based Records', 0.15, 5000, 0.12, 'per_record', false),
  ('text_processing', 'AI Processing - Text-Based Records', 0.04, 5000, 0.025, 'per_record', false),
  ('data_appending', 'Data Appending and Enrichment', 0.30, 5000, 0.20, 'per_record', true),
  ('email_delivery', 'Outbound Email Delivery', 0.01, NULL, NULL, 'per_email', true),
  ('sms_delivery', 'Outbound SMS Delivery', 0.05, NULL, NULL, 'per_segment', true),
  ('chat_delivery', 'Chat or Messaging Delivery', 0.02, NULL, NULL, 'per_interaction', true),
  ('telephony', 'Telephony Services', 0.012, NULL, NULL, 'per_minute', true),
  ('voice_coaching', 'Voice Feedback, QA & Sales Coaching', 0.55, NULL, NULL, 'per_record', true);

-- 2. Create invoice_line_items table
CREATE TABLE public.invoice_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  service_category TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_rate NUMERIC(10,6) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,4) NOT NULL DEFAULT 0,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage invoice line items" ON public.invoice_line_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- 3. Update billing_invoices table
ALTER TABLE public.billing_invoices 
  ADD COLUMN invoice_number TEXT,
  ADD COLUMN payment_terms TEXT DEFAULT 'Net 30',
  ADD COLUMN due_date DATE;

-- 4. Update clients table
ALTER TABLE public.clients
  ADD COLUMN payment_terms_days INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN enabled_services JSONB DEFAULT '["voice_processing", "text_processing"]'::jsonb;

-- 5. Create invoice number generation function
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_year TEXT;
  next_seq INTEGER;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(NULLIF(split_part(invoice_number, '-', 3), '') AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM billing_invoices
  WHERE invoice_number LIKE 'INV-' || current_year || '-%';
  
  RETURN 'INV-' || current_year || '-' || LPAD(next_seq::TEXT, 3, '0');
END;
$$;

-- 6. Create trigger to auto-set invoice_number and due_date
CREATE OR REPLACE FUNCTION public.set_invoice_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := public.generate_invoice_number();
  END IF;
  IF NEW.due_date IS NULL AND NEW.payment_terms IS NOT NULL THEN
    NEW.due_date := (NEW.created_at::date + 
      CASE 
        WHEN NEW.payment_terms = 'Net 15' THEN 15
        ELSE 30
      END);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_invoice_defaults_trigger
  BEFORE INSERT ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_defaults();

-- Update trigger for sow_pricing_config
CREATE TRIGGER update_sow_pricing_updated_at
  BEFORE UPDATE ON public.sow_pricing_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
