-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'supervisor', 'agent');

-- Create sites table
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('outsourced', 'internal')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  site_id UUID REFERENCES public.sites(id),
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create agents table
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  site_id UUID REFERENCES public.sites(id) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_in_date DATE NOT NULL,
  booking_date DATE NOT NULL,
  member_name TEXT NOT NULL,
  booking_type TEXT NOT NULL CHECK (booking_type IN ('Inbound', 'Outbound', 'Referral')),
  agent_id UUID REFERENCES public.agents(id) NOT NULL,
  market_city TEXT,
  market_state TEXT,
  communication_method TEXT CHECK (communication_method IN ('Phone', 'SMS', 'LC', 'Email')),
  status TEXT NOT NULL DEFAULT 'Pending Move-In' CHECK (status IN ('Pending Move-In', 'Moved In', 'Member Rejected', 'No Show', 'Cancelled')),
  notes TEXT,
  hubspot_link TEXT,
  kixie_link TEXT,
  admin_profile_link TEXT,
  move_in_day_reach_out BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create display_tokens table
CREATE TABLE public.display_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  site_filter UUID REFERENCES public.sites(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create access_logs table
CREATE TABLE public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  user_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('login', 'logout', 'view_dashboard', 'export_csv', 'role_change', 'data_import')),
  resource TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.display_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Function to get user's site_id
CREATE OR REPLACE FUNCTION public.get_user_site_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT site_id
  FROM public.profiles
  WHERE id = _user_id
$$;

-- RLS Policies for sites
CREATE POLICY "Everyone can view sites" ON public.sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can manage sites" ON public.sites FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT TO authenticated 
  USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Super admin can manage roles" ON public.user_roles FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated 
  USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated 
  USING (id = auth.uid());
CREATE POLICY "Super admin can manage all profiles" ON public.profiles FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for agents
CREATE POLICY "Authenticated users can view agents" ON public.agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage agents" ON public.agents FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for bookings
CREATE POLICY "Users can view bookings based on role" ON public.bookings FOR SELECT TO authenticated 
  USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'admin') OR
    (public.has_role(auth.uid(), 'supervisor') AND agent_id IN (
      SELECT id FROM public.agents WHERE site_id = public.get_user_site_id(auth.uid())
    )) OR
    (public.has_role(auth.uid(), 'agent') AND agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    ))
  );
CREATE POLICY "Admins and supervisors can create bookings" ON public.bookings FOR INSERT TO authenticated 
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  );
CREATE POLICY "Admins and supervisors can update bookings" ON public.bookings FOR UPDATE TO authenticated 
  USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'supervisor')
  );
CREATE POLICY "Super admin can delete bookings" ON public.bookings FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for display_tokens
CREATE POLICY "Admins can manage display tokens" ON public.display_tokens FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public can validate tokens" ON public.display_tokens FOR SELECT TO anon USING (true);

-- RLS Policies for access_logs
CREATE POLICY "Admins can view access logs" ON public.access_logs FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can create access logs" ON public.access_logs FOR INSERT TO authenticated 
  WITH CHECK (true);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default sites
INSERT INTO public.sites (name, type) VALUES 
  ('Vixicom', 'outsourced'),
  ('PadSplit Internal', 'internal');