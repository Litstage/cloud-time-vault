
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

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

CREATE POLICY "Users can view their own approval"
ON public.user_approvals FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all approvals"
ON public.user_approvals FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Helper: is user approved (admins are always approved)
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_approvals
    WHERE user_id = _user_id AND status = 'approved'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  );
$$;

-- Create approval row automatically for every new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_approvals (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_approval
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_approval();

-- Backfill existing users as approved so they keep access
INSERT INTO public.user_approvals (user_id, status, approved_at)
SELECT id, 'approved', now() FROM auth.users
ON CONFLICT (user_id) DO UPDATE SET status = 'approved', approved_at = now();

-- claim_first_admin now also approves the new admin
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- Lock down time_entries writes to approved users only
DROP POLICY IF EXISTS "Own time entries" ON public.time_entries;

CREATE POLICY "Users can view their own time entries"
ON public.time_entries FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Approved users can insert own time entries"
ON public.time_entries FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()));

CREATE POLICY "Approved users can update own time entries"
ON public.time_entries FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.is_approved(auth.uid()))
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own time entries"
ON public.time_entries FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Lock down projects writes (shared workspace) to approved users only
DROP POLICY IF EXISTS "Anyone authenticated can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone authenticated can update projects" ON public.projects;
DROP POLICY IF EXISTS "Anyone authenticated can delete projects" ON public.projects;

CREATE POLICY "Approved users can insert projects"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (public.is_approved(auth.uid()));

CREATE POLICY "Approved users can update projects"
ON public.projects FOR UPDATE TO authenticated
USING (public.is_approved(auth.uid()))
WITH CHECK (public.is_approved(auth.uid()));

CREATE POLICY "Approved users can delete projects"
ON public.projects FOR DELETE TO authenticated
USING (public.is_approved(auth.uid()));
