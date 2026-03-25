/*
  # Add anonymous upload/update/delete policies for enterprise-images storage bucket

  Since this application operates as a public dashboard without authentication,
  the anon role needs upload permissions to support batch image uploads via script.

  1. Security Changes
    - Add INSERT policy for anon role on storage.objects for enterprise-images bucket
    - Add UPDATE policy for anon role on storage.objects for enterprise-images bucket
    - Add DELETE policy for anon role on storage.objects for enterprise-images bucket

  2. Important Notes
    - These policies allow anonymous storage access for a public-facing tool
    - In production, authentication should be added
*/

CREATE POLICY "Allow anonymous upload to enterprise images"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'enterprise-images');

CREATE POLICY "Allow anonymous update enterprise images"
  ON storage.objects
  FOR UPDATE
  TO anon
  USING (bucket_id = 'enterprise-images')
  WITH CHECK (bucket_id = 'enterprise-images');

CREATE POLICY "Allow anonymous delete enterprise images"
  ON storage.objects
  FOR DELETE
  TO anon
  USING (bucket_id = 'enterprise-images');
