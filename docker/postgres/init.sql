-- MESS Platform — PostgreSQL init script
-- Runs once when the container is first created.

-- Enable PostGIS if available (for geo queries)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable pg_trgm for fuzzy search (address autocomplete)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'Africa/Dakar';
