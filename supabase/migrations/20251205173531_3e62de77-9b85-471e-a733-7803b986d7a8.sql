-- Create call_types table
CREATE TABLE public.call_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text DEFAULT 'phone',
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  scoring_criteria jsonb,
  analysis_focus text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create company_knowledge table
CREATE TABLE public.company_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  call_type_ids uuid[],
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create call_type_rules table
CREATE TABLE public.call_type_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_type_id uuid REFERENCES public.call_types(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  rule_description text,
  rule_type text NOT NULL,
  ai_instruction text,
  weight integer DEFAULT 5,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create script_templates table
CREATE TABLE public.script_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  call_type_id uuid REFERENCES public.call_types(id) ON DELETE CASCADE,
  script_content text NOT NULL,
  sections jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Add call_type_id to bookings table
ALTER TABLE public.bookings ADD COLUMN call_type_id uuid REFERENCES public.call_types(id);

-- Enable RLS on all new tables
ALTER TABLE public.call_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_type_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_templates ENABLE ROW LEVEL SECURITY;

-- RLS for call_types: Admin/Super Admin can manage, authenticated users can view active
CREATE POLICY "Admins can manage call_types"
ON public.call_types FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active call_types"
ON public.call_types FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- RLS for company_knowledge: Admin/Super Admin only
CREATE POLICY "Admins can manage company_knowledge"
ON public.company_knowledge FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS for call_type_rules: Admin/Super Admin only
CREATE POLICY "Admins can manage call_type_rules"
ON public.call_type_rules FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS for script_templates: Admin/Super Admin only
CREATE POLICY "Admins can manage script_templates"
ON public.script_templates FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Update triggers for updated_at
CREATE TRIGGER update_call_types_updated_at
BEFORE UPDATE ON public.call_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_knowledge_updated_at
BEFORE UPDATE ON public.company_knowledge
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_call_type_rules_updated_at
BEFORE UPDATE ON public.call_type_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_script_templates_updated_at
BEFORE UPDATE ON public.script_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();