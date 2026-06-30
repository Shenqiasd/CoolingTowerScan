/*
  # Survey files storage bucket

  Stores HVAC survey source files uploaded from the data collection workflow.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('survey-files', 'survey-files', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated read survey files'
  ) THEN
    CREATE POLICY "Allow authenticated read survey files"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'survey-files');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated upload survey files'
  ) THEN
    CREATE POLICY "Allow authenticated upload survey files"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'survey-files');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated update survey files'
  ) THEN
    CREATE POLICY "Allow authenticated update survey files"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'survey-files')
      WITH CHECK (bucket_id = 'survey-files');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated delete survey files'
  ) THEN
    CREATE POLICY "Allow authenticated delete survey files"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'survey-files');
  END IF;
END $$;
