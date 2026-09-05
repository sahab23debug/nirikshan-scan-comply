
-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen','officer')),
  officer_id text UNIQUE,
  home_lat double precision,
  home_lng double precision,
  district text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_officer(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND role = 'officer' AND officer_id IS NOT NULL);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- officer registry (seeded valid officer IDs)
CREATE TABLE public.officer_registry (
  officer_id text PRIMARY KEY,
  officer_name text NOT NULL,
  district text NOT NULL,
  state text NOT NULL,
  home_lat double precision NOT NULL,
  home_lng double precision NOT NULL,
  claimed_by uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.officer_registry TO authenticated;
GRANT ALL ON public.officer_registry TO service_role;
ALTER TABLE public.officer_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registry_select" ON public.officer_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "registry_claim" ON public.officer_registry FOR UPDATE TO authenticated
  USING (claimed_by IS NULL OR claimed_by = auth.uid()) WITH CHECK (claimed_by = auth.uid());

INSERT INTO public.officer_registry (officer_id, officer_name, district, state, home_lat, home_lng) VALUES
('LM-DL-1024','A. Sharma','New Delhi','Delhi',28.6139,77.2090),
('LM-MH-2087','R. Deshmukh','Mumbai City','Maharashtra',19.0760,72.8777),
('LM-KA-3312','S. Gowda','Bengaluru Urban','Karnataka',12.9716,77.5946),
('LM-TN-4450','K. Murugan','Chennai','Tamil Nadu',13.0827,80.2707),
('LM-WB-5591','P. Banerjee','Kolkata','West Bengal',22.5726,88.3639),
('LM-UP-6673','V. Yadav','Lucknow','Uttar Pradesh',26.8467,80.9462);

-- product repository
CREATE TABLE public.products (
  barcode text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  brand text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert" ON public.products FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO public.products (barcode, name, category, brand) VALUES
('8901058000108','Instant Noodles Masala 70g','Food','Nooda'),
('8901030510717','Herbal Face Wash 100ml','Cosmetics','Vanya'),
('8904004400015','LED Bulb 9W','Electronics','Lumex'),
('8901063013810','Digestive Biscuits 250g','Food','GrainCo'),
('8901396253075','Facial Tissues 200 pulls','Other','SoftPlus');

-- scans
CREATE TABLE public.scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  product_name text,
  category text NOT NULL,
  barcode text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  lat double precision,
  lng double precision,
  location_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.scans TO authenticated;
GRANT ALL ON public.scans TO service_role;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scans_select_own_or_officer" ON public.scans FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_officer(auth.uid()));
CREATE POLICY "scans_insert_own" ON public.scans FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- reports
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  overall_status text NOT NULL CHECK (overall_status IN ('compliant','non_compliant','needs_review')),
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  nutrition jsonb,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_select_own_or_officer" ON public.reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_officer(auth.uid()));
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reports_update_officer" ON public.reports FOR UPDATE TO authenticated
  USING (public.is_officer(auth.uid())) WITH CHECK (public.is_officer(auth.uid()));

-- citizen flags
CREATE TABLE public.citizen_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports ON DELETE CASCADE,
  citizen_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  officer_registry_id text NOT NULL REFERENCES public.officer_registry(officer_id),
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.citizen_flags TO authenticated;
GRANT ALL ON public.citizen_flags TO service_role;
ALTER TABLE public.citizen_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flags_select" ON public.citizen_flags FOR SELECT TO authenticated
  USING (citizen_id = auth.uid() OR officer_registry_id IN (SELECT officer_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "flags_insert_own" ON public.citizen_flags FOR INSERT TO authenticated WITH CHECK (citizen_id = auth.uid());
CREATE POLICY "flags_update_officer" ON public.citizen_flags FOR UPDATE TO authenticated
  USING (officer_registry_id IN (SELECT officer_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (officer_registry_id IN (SELECT officer_id FROM public.profiles WHERE id = auth.uid()));

-- audit trail
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select" ON public.audit_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_officer(auth.uid()));
CREATE POLICY "audit_insert_own" ON public.audit_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_scans_user ON public.scans(user_id, created_at DESC);
CREATE INDEX idx_reports_user ON public.reports(user_id, created_at DESC);
CREATE INDEX idx_flags_officer ON public.citizen_flags(officer_registry_id, status);
