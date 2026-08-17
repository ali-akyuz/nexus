-- NEXUS — PostgreSQL Initialization Script
-- This runs once when the Docker PostgreSQL container is first created.
-- Actual schema is managed by Prisma migrations.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create application schema (if not using 'public')
-- CREATE SCHEMA IF NOT EXISTS nexus;

-- Grant permissions to app user
GRANT ALL PRIVILEGES ON DATABASE nexus TO nexus_user;
