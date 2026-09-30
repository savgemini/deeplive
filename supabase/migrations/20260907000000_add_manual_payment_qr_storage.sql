INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-method-qrs',
  'payment-method-qrs',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "payment_method_qrs_admin_insert" ON storage.objects;
CREATE POLICY "payment_method_qrs_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-method-qrs' AND public.is_admin());

DROP POLICY IF EXISTS "payment_method_qrs_admin_update" ON storage.objects;
CREATE POLICY "payment_method_qrs_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-method-qrs' AND public.is_admin())
  WITH CHECK (bucket_id = 'payment-method-qrs' AND public.is_admin());

DROP POLICY IF EXISTS "payment_method_qrs_admin_delete" ON storage.objects;
CREATE POLICY "payment_method_qrs_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'payment-method-qrs' AND public.is_admin());