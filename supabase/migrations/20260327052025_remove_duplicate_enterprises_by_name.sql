/*
  # Remove Duplicate Enterprises by Name

  ## Summary
  Deduplicate the enterprises table by keeping only one row per unique enterprise_name.

  ## Strategy
  - For each group of rows sharing the same enterprise_name, keep the row with the earliest created_at
  - Where created_at is identical, use ctid (physical row identity) as a tiebreaker
  - Delete all other duplicate rows

  ## Stats (before migration)
  - Total rows: 8714
  - Unique names: 5405
  - Rows to delete: ~3309
*/

DELETE FROM enterprises
WHERE ctid NOT IN (
  SELECT DISTINCT ON (enterprise_name) ctid
  FROM enterprises
  ORDER BY enterprise_name, created_at ASC, ctid ASC
);
