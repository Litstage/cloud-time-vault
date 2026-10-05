DROP POLICY IF EXISTS "Anyone authenticated can view projects" ON public.projects;
CREATE POLICY "Approved users can view projects" ON public.projects
  FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read clients" ON public.clients;
CREATE POLICY "Admins can read clients" ON public.clients
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated read ob rules" ON public.ob_rules;
CREATE POLICY "Admins read ob rules" ON public.ob_rules
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can read tax_tables" ON public.tax_tables;
DROP POLICY IF EXISTS "Authenticated can read tax_table_rows" ON public.tax_table_rows;