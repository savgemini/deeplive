ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS vpay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method text;

UPDATE public.settings AS settings
SET manual_payment_methods =
  (CASE
    WHEN COALESCE(settings.manual_payment_bank_name, '') <> ''
      OR COALESCE(settings.manual_payment_account_name, '') <> ''
      OR COALESCE(settings.manual_payment_account_number, '') <> ''
      OR COALESCE(settings.manual_payment_instructions, '') <> ''
    THEN jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', 'Bank transfer',
      'fields', jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Bank', 'value', COALESCE(settings.manual_payment_bank_name, '')),
        jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Account name', 'value', COALESCE(settings.manual_payment_account_name, '')),
        jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Account number', 'value', COALESCE(settings.manual_payment_account_number, '')),
        jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Instructions', 'value', COALESCE(settings.manual_payment_instructions, ''))
      )
    ))
    ELSE '[]'::jsonb
  END)
  ||
  (CASE
    WHEN COALESCE(settings.manual_payment_wallet_name, '') <> ''
      OR COALESCE(settings.manual_payment_wallet_number, '') <> ''
    THEN jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', 'Wallet transfer',
      'fields', jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Wallet', 'value', COALESCE(settings.manual_payment_wallet_name, '')),
        jsonb_build_object('id', gen_random_uuid()::text, 'label', 'Wallet number', 'value', COALESCE(settings.manual_payment_wallet_number, ''))
      )
    ))
    ELSE '[]'::jsonb
  END)
WHERE settings.manual_payment_methods = '[]'::jsonb;

DROP POLICY IF EXISTS "settings_public_read" ON public.settings;
CREATE POLICY "settings_admin_read" ON public.settings
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE VIEW public.settings_public AS
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
  updated_at,
  vpay_enabled,
  manual_payment_methods
FROM public.settings;

GRANT SELECT ON public.settings_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';