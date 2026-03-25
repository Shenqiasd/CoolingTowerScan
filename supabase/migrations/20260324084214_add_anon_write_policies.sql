/*
  # Add anonymous write policies for enterprises

  Since this application operates as a public dashboard without authentication,
  the anon role needs INSERT and UPDATE permissions to support CSV import and
  enterprise data updates.

  1. Security Changes
    - Add INSERT policy for anon role on enterprises table
    - Add UPDATE policy for anon role on enterprises table

  2. Important Notes
    - These policies allow anonymous access for a public-facing tool
    - In production, authentication should be added
*/

CREATE POLICY "Allow anonymous insert to enterprises"
  ON enterprises
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update to enterprises"
  ON enterprises
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
