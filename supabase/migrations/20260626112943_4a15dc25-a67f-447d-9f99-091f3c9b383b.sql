
CREATE TABLE public.user_wages (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  ob1_pct numeric(5,2) NOT NULL DEFAULT 0,
  ob2_pct numeric(5,2) NOT NULL DEFAULT 0,
  ob3_pct numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_wages TO authenticated;
GRANT ALL ON public.user_wages TO service_role;
ALTER TABLE public.user_wages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage wages" ON public.user_wages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_user_wages_updated_at BEFORE UPDATE ON public.user_wages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ob_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level smallint NOT NULL CHECK (level IN (1,2,3)),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ob_rules TO authenticated;
GRANT ALL ON public.ob_rules TO service_role;
ALTER TABLE public.ob_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read ob rules" ON public.ob_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage ob rules" ON public.ob_rules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update ob rules" ON public.ob_rules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete ob rules" ON public.ob_rules FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_ob_rules_updated_at BEFORE UPDATE ON public.ob_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
