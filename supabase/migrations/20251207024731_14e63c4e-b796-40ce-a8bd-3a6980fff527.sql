-- Create clients table for multi-client billing support
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  billing_period TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('daily', 'weekly', 'monthly')),
  markup_percentage DECIMAL(5,2) NOT NULL DEFAULT 25.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create api_costs table to log all API costs
CREATE TABLE public.api_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  service_provider TEXT NOT NULL CHECK (service_provider IN ('elevenlabs', 'lovable_ai')),
  service_type TEXT NOT NULL,
  edge_function TEXT NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  audio_duration_seconds INTEGER,
  character_count INTEGER,
  estimated_cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create billing_invoices table for generated invoices
CREATE TABLE public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  raw_cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0,
  markup_usd DECIMAL(10,4) NOT NULL DEFAULT 0,
  total_usd DECIMAL(10,4) NOT NULL DEFAULT 0,
  cost_breakdown JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only super_admin can access these tables
CREATE POLICY "Super admin can manage clients"
ON public.clients
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can view api_costs"
ON public.api_costs
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can manage billing_invoices"
ON public.billing_invoices
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Insert default PadSplit client
INSERT INTO public.clients (name, contact_email, billing_period, markup_percentage)
VALUES ('PadSplit', 'billing@padsplit.com', 'monthly', 25.00);

-- Create index for efficient cost queries
CREATE INDEX idx_api_costs_created_at ON public.api_costs(created_at DESC);
CREATE INDEX idx_api_costs_service_provider ON public.api_costs(service_provider);
CREATE INDEX idx_api_costs_edge_function ON public.api_costs(edge_function);
CREATE INDEX idx_billing_invoices_client_id ON public.billing_invoices(client_id);
CREATE INDEX idx_billing_invoices_status ON public.billing_invoices(status);