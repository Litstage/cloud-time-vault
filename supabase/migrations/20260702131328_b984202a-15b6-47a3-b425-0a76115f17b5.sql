ALTER TABLE public.user_wages
  ADD COLUMN IF NOT EXISTS employer_fee_pct numeric NOT NULL DEFAULT 31.42,
  ADD COLUMN IF NOT EXISTS tax_pct numeric NOT NULL DEFAULT 30;