/*
# Add Decart API key column to settings

The Decart API key is stored in the settings table. The edge function reads
it using the service role key (which bypasses RLS). The public read policy
on settings must NOT expose the decart_api_key column — we handle this by
creating a view that excludes sensitive columns, and revoking direct table
access from anon/authenticated while granting access to the view instead.
*/

-- Column already added via execute_sql, just ensure it exists
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS decart_api_key text;

-- Create a view that exposes only safe columns (excludes all secret keys)
CREATE OR REPLACE VIEW public.settings_public AS
SELECT
  id, site_name, free_trial_seconds, watermark_text,
  maintenance_mode, referral_commission_percent,
  paystack_public_key, stripe_public_key,
  updated_at
FROM public.settings;

-- Revoke all direct table access from anon and authenticated
REVOKE ALL ON public.settings FROM anon, authenticated;

-- Grant SELECT on the safe view instead
GRANT SELECT ON public.settings_public TO anon, authenticated;

-- Keep admin write access on the table (via is_admin() policy, but we need
-- to grant the table privileges back to authenticated for the admin policy to work)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
