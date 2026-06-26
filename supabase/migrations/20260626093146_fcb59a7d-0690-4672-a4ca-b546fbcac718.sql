
-- Make projects shared across all authenticated users
DROP POLICY IF EXISTS "Own projects" ON public.projects;

-- Allow user_id to be nullable (kept for "created by" attribution only)
ALTER TABLE public.projects ALTER COLUMN user_id DROP NOT NULL;

CREATE POLICY "Anyone authenticated can view projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone authenticated can insert projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone authenticated can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone authenticated can delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (true);
