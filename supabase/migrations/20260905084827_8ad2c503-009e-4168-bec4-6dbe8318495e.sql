
CREATE POLICY "scan_images_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scan-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "scan_images_select_own_or_officer" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'scan-images' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_officer(auth.uid())));
