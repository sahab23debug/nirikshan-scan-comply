CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;

CREATE TABLE public.approved_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text UNIQUE,
  name text NOT NULL,
  brand text,
  category text NOT NULL,
  imported boolean NOT NULL DEFAULT false,
  multi_pack boolean NOT NULL DEFAULT false,
  declarations jsonb NOT NULL DEFAULT '{}'::jsonb,
  nutrition jsonb,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  officer_id text,
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.approved_products TO authenticated;
GRANT ALL ON public.approved_products TO service_role;

ALTER TABLE public.approved_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved_products_select" ON public.approved_products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "approved_products_insert_officer" ON public.approved_products
  FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND public.is_officer(auth.uid()));

CREATE POLICY "approved_products_update_officer" ON public.approved_products
  FOR UPDATE TO authenticated
  USING (public.is_officer(auth.uid()))
  WITH CHECK (public.is_officer(auth.uid()));

CREATE TRIGGER approved_products_updated_at
  BEFORE UPDATE ON public.approved_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.scan_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  note text,
  location_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.scan_batches TO authenticated;
GRANT ALL ON public.scan_batches TO service_role;

ALTER TABLE public.scan_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_batches_insert_own" ON public.scan_batches
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "scan_batches_select" ON public.scan_batches
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_officer(auth.uid()));

CREATE POLICY "scan_batches_update_own" ON public.scan_batches
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER scan_batches_updated_at
  BEFORE UPDATE ON public.scan_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.reports ADD COLUMN batch_id uuid REFERENCES public.scan_batches(id) ON DELETE SET NULL;
CREATE INDEX reports_batch_id_idx ON public.reports(batch_id);