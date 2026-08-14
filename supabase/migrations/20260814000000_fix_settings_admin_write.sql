/*
# Fix settings save failures for the admin settings screen

The UI saves to the singleton settings row using id = 1. If the row is missing,
Postgres will not update any record and the client reports a generic save failure.
Also, the admin RLS policy depends on the JWT app_metadata.role claim. This
migration ensures that row 1 exists and that the admin role metadata is set for
known admin accounts.
*/

INSERT INTO public.settings (
  id,
  site_name,
  free_trial_seconds,
  watermark_text,
  maintenance_mode,
  referral_commission_percent,
  updated_at
)
VALUES (
  1,
  'DeepLive',
  20,
  'DeepLive',
  false,
  10,
  now()
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE email = 'admin@deeplive.app';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
