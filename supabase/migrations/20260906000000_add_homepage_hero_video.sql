ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS hero_video_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-media',
  'site-media',
  true,
  524288000,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/ogg']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "site_media_admin_insert" ON storage.objects;
CREATE POLICY "site_media_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-media' AND public.is_admin());

DROP POLICY IF EXISTS "site_media_admin_update" ON storage.objects;
CREATE POLICY "site_media_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'site-media' AND public.is_admin())
  WITH CHECK (bucket_id = 'site-media' AND public.is_admin());

DROP POLICY IF EXISTS "site_media_admin_delete" ON storage.objects;
CREATE POLICY "site_media_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'site-media' AND public.is_admin());

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
  manual_payment_methods,
  hero_video_url
FROM public.settings;

GRANT SELECT ON public.settings_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';