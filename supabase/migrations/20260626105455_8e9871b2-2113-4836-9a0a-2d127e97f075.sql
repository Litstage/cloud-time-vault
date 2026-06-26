CREATE TABLE public.time_entry_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id uuid,
  entry_user_id uuid,
  action text NOT NULL CHECK (action IN ('create','update','delete')),
  changed_by uuid NOT NULL,
  changed_by_email text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_time_entry_audit_created_at ON public.time_entry_audit (created_at DESC);
CREATE INDEX idx_time_entry_audit_entry_id ON public.time_entry_audit (entry_id);
GRANT SELECT, INSERT ON public.time_entry_audit TO authenticated;
GRANT ALL ON public.time_entry_audit TO service_role;
ALTER TABLE public.time_entry_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit log" ON public.time_entry_audit FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));