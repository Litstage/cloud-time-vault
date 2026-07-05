-- =============================================================================
-- Fullständig databasstruktur (public schema)
-- Genererad från nuvarande projektdatabas. Kör mot en tom Supabase/Postgres
-- databas för att återskapa struktur, funktioner, policies, triggers och index.
-- Innehåller INGEN data.
-- =============================================================================

-- Kräver att auth.users finns (Supabase-standard). Skapa manuellt om du kör
-- utan Supabase.

-- =========================
-- ENUM-TYPER
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- =========================
-- FUNKTION: updated_at helper
-- =========================
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

-- =========================
-- TABELL: user_roles
-- =========================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================
-- FUNKTION: has_role (security definer)
-- =========================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Policies för user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- TABELL: user_approvals
-- =========================
CREATE TABLE public.user_approvals (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.approval_status NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_approvals TO authenticated;
GRANT ALL ON public.user_approvals TO service_role;
ALTER TABLE public.user_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own approval" ON public.user_approvals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all approvals" ON public.user_approvals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- FUNKTION: is_approved
-- =========================
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_approvals
    WHERE user_id = _user_id AND status = 'approved'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  );
$$;

-- =========================
-- FUNKTION: claim_first_admin
-- =========================
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.user_approvals (user_id, status, approved_at, approved_by)
  VALUES (uid, 'approved', now(), uid)
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'approved', approved_at = now(), approved_by = uid;
  RETURN true;
END;
$$;

-- =========================
-- FUNKTION + TRIGGER: skapa approval-rad vid ny user
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_approvals (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger på auth.users för att auto-skapa approval-rad
DROP TRIGGER IF EXISTS on_auth_user_created_approval ON auth.users;
CREATE TRIGGER on_auth_user_created_approval
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_approval();

-- =========================
-- TABELL: clients
-- =========================
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  note text,
  hourly_rate numeric NOT NULL DEFAULT 0,
  ob1_rate numeric NOT NULL DEFAULT 0,
  ob2_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read clients" ON public.clients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete clients" ON public.clients
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- TABELL: ob_rules
-- =========================
CREATE TABLE public.ob_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level smallint NOT NULL,
  weekday smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ob_rules TO authenticated;
GRANT ALL ON public.ob_rules TO service_role;
ALTER TABLE public.ob_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ob rules" ON public.ob_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage ob rules" ON public.ob_rules
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update ob rules" ON public.ob_rules
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete ob rules" ON public.ob_rules
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ob_rules_updated_at BEFORE UPDATE ON public.ob_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- TABELL: projects
-- =========================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  client text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  color text NOT NULL DEFAULT '#6366f1',
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_client_id ON public.projects(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view projects" ON public.projects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete projects" ON public.projects
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- TABELL: tax_tables
-- =========================
CREATE TABLE public.tax_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  table_number integer NOT NULL,
  period text NOT NULL DEFAULT 'month',
  source_url text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, table_number, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_tables TO authenticated;
GRANT ALL ON public.tax_tables TO service_role;
ALTER TABLE public.tax_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read tax_tables" ON public.tax_tables
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tax_tables" ON public.tax_tables
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_tax_tables_updated_at BEFORE UPDATE ON public.tax_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- TABELL: tax_table_rows
-- =========================
CREATE TABLE public.tax_table_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_table_id uuid NOT NULL REFERENCES public.tax_tables(id) ON DELETE CASCADE,
  income_from integer NOT NULL,
  income_to integer NOT NULL,
  col1 integer NOT NULL DEFAULT 0,
  col2 integer NOT NULL DEFAULT 0,
  col3 integer NOT NULL DEFAULT 0,
  col4 integer NOT NULL DEFAULT 0,
  col5 integer NOT NULL DEFAULT 0,
  col6 integer NOT NULL DEFAULT 0,
  UNIQUE (tax_table_id, income_from)
);
CREATE INDEX tax_table_rows_lookup_idx
  ON public.tax_table_rows(tax_table_id, income_from, income_to);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_table_rows TO authenticated;
GRANT ALL ON public.tax_table_rows TO service_role;
ALTER TABLE public.tax_table_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read tax_table_rows" ON public.tax_table_rows
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tax_table_rows" ON public.tax_table_rows
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- TABELL: time_entries
-- =========================
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX time_entries_user_start_idx ON public.time_entries(user_id, start_time DESC);
CREATE INDEX time_entries_running_idx ON public.time_entries(user_id) WHERE end_time IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own time entries" ON public.time_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all time entries" ON public.time_entries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Approved users can insert own time entries" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()));
CREATE POLICY "Admins can insert time entries" ON public.time_entries
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Approved users can update own time entries" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_approved(auth.uid()))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update time entries" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own time entries" ON public.time_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete time entries" ON public.time_entries
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- TABELL: time_entry_audit
-- =========================
CREATE TABLE public.time_entry_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid,
  entry_user_id uuid,
  action text NOT NULL,
  changed_by uuid NOT NULL,
  changed_by_email text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_time_entry_audit_entry_id ON public.time_entry_audit(entry_id);
CREATE INDEX idx_time_entry_audit_created_at ON public.time_entry_audit(created_at DESC);
GRANT SELECT, INSERT ON public.time_entry_audit TO authenticated;
GRANT ALL ON public.time_entry_audit TO service_role;
ALTER TABLE public.time_entry_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log" ON public.time_entry_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- TABELL: user_wages
-- =========================
CREATE TABLE public.user_wages (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hourly_rate numeric NOT NULL DEFAULT 0,
  ob1_pct numeric NOT NULL DEFAULT 0,
  ob2_pct numeric NOT NULL DEFAULT 0,
  ob3_pct numeric NOT NULL DEFAULT 0,
  employer_fee_pct numeric NOT NULL DEFAULT 31.42,
  tax_pct numeric NOT NULL DEFAULT 30,
  tax_table_number integer NOT NULL DEFAULT 32,
  tax_table_column smallint NOT NULL DEFAULT 1,
  personal_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_wages TO authenticated;
GRANT ALL ON public.user_wages TO service_role;
ALTER TABLE public.user_wages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wages" ON public.user_wages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_wages_updated_at BEFORE UPDATE ON public.user_wages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- Slut på schema.
-- =============================================================================