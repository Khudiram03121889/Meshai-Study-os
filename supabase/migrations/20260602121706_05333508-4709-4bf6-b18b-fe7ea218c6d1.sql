
CREATE POLICY "notes own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'notes-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "notes own insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notes-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "notes own update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'notes-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "notes own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'notes-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
