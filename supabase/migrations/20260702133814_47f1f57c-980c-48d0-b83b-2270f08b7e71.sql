
-- 1. tax_tables
CREATE TABLE public.tax_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  table_number int NOT NULL,
  period text NOT NULL DEFAULT 'month',
  source_url text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, table_number, period)
);
GRANT SELECT ON public.tax_tables TO authenticated;
GRANT ALL ON public.tax_tables TO service_role;
ALTER TABLE public.tax_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read tax_tables"
  ON public.tax_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tax_tables"
  ON public.tax_tables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_tax_tables_updated_at
  BEFORE UPDATE ON public.tax_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. tax_table_rows
CREATE TABLE public.tax_table_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_table_id uuid NOT NULL REFERENCES public.tax_tables(id) ON DELETE CASCADE,
  income_from int NOT NULL,
  income_to int NOT NULL,
  col1 int NOT NULL DEFAULT 0,
  col2 int NOT NULL DEFAULT 0,
  col3 int NOT NULL DEFAULT 0,
  col4 int NOT NULL DEFAULT 0,
  col5 int NOT NULL DEFAULT 0,
  col6 int NOT NULL DEFAULT 0,
  UNIQUE (tax_table_id, income_from)
);
CREATE INDEX tax_table_rows_lookup_idx
  ON public.tax_table_rows (tax_table_id, income_from, income_to);
GRANT SELECT ON public.tax_table_rows TO authenticated;
GRANT ALL ON public.tax_table_rows TO service_role;
ALTER TABLE public.tax_table_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read tax_table_rows"
  ON public.tax_table_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tax_table_rows"
  ON public.tax_table_rows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. user_wages new columns
ALTER TABLE public.user_wages
  ADD COLUMN IF NOT EXISTS tax_table_number int NOT NULL DEFAULT 32,
  ADD COLUMN IF NOT EXISTS tax_table_column smallint NOT NULL DEFAULT 1;
