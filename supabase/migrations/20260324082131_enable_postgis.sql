/*
  # Enable PostGIS Extension

  1. Extensions
    - Enable PostGIS for spatial data support (geometry types, spatial indexes, spatial functions)
  
  2. Notes
    - Required for storing enterprise geographic coordinates as geometry points
    - Enables spatial queries like bounding box filtering for map viewport
*/

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
