ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS vpay_public_key text,
  ADD COLUMN IF NOT EXISTS vpay_secret_key text,
  ADD COLUMN IF NOT EXISTS manual_payment_bank_name text,
  ADD COLUMN IF NOT EXISTS manual_payment_account_name text,
  ADD COLUMN IF NOT EXISTS manual_payment_account_number text,
  ADD COLUMN IF NOT EXISTS manual_payment_wallet_name text,
  ADD COLUMN IF NOT EXISTS manual_payment_wallet_number text,
  ADD COLUMN IF NOT EXISTS manual_payment_instructions text;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS payment_note text;

DROP VIEW IF EXISTS public.settings_public;
CREATE VIEW public.settings_public AS
SELECT
  id,
  site_name,
  free_trial_seconds,
  watermark_text,
  maintenance_mode,
  referral_commission_percent,
  paystack_public_key,
  vpay_public_key,
  manual_payment_bank_name,
  manual_payment_account_name,
  manual_payment_account_number,
  manual_payment_wallet_name,
  manual_payment_wallet_number,
  manual_payment_instructions,
  updated_at
FROM public.settings;

GRANT SELECT ON public.settings_public TO anon, authenticated;
