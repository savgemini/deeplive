INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tutorial-videos',
  'tutorial-videos',
  true,
  524288000,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/ogg']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "tutorial_videos_admin_insert" ON storage.objects;
CREATE POLICY "tutorial_videos_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tutorial-videos' AND public.is_admin());

DROP POLICY IF EXISTS "tutorial_videos_admin_update" ON storage.objects;
CREATE POLICY "tutorial_videos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'tutorial-videos' AND public.is_admin())
  WITH CHECK (bucket_id = 'tutorial-videos' AND public.is_admin());

DROP POLICY IF EXISTS "tutorial_videos_admin_delete" ON storage.objects;
CREATE POLICY "tutorial_videos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tutorial-videos' AND public.is_admin());