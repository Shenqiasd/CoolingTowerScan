/*
  # Create Storage Bucket for Enterprise Images

  1. Storage
    - Create `enterprise-images` bucket for storing original and annotated satellite/aerial images
    - Set bucket to public for easy image display in the dashboard

  2. Security
    - Allow anonymous users to view/download images (public bucket for dashboard display)
    - Allow authenticated users to upload and manage images
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('enterprise-images', 'enterprise-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read access to enterprise images"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'enterprise-images');

CREATE POLICY "Allow authenticated read access to enterprise images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'enterprise-images');

CREATE POLICY "Allow authenticated upload to enterprise images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'enterprise-images');

CREATE POLICY "Allow authenticated update enterprise images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'enterprise-images')
  WITH CHECK (bucket_id = 'enterprise-images');

CREATE POLICY "Allow authenticated delete enterprise images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'enterprise-images');
