
DROP POLICY IF EXISTS "Approved users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Approved users can update projects" ON public.projects;
DROP POLICY IF EXISTS "Approved users can delete projects" ON public.projects;

CREATE POLICY "Admins can insert projects"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update projects"
ON public.projects FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete projects"
ON public.projects FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
