-- Rollback Migration: Drop qbo_tokens table
-- Description: Rollback script for creating qbo_tokens table (Clerk version)
-- Created: 2025-01-07
-- Note: This rollback is for the Clerk-compatible version without RLS policies

-- Drop trigger
DROP TRIGGER IF EXISTS update_qbo_tokens_updated_at ON qbo_tokens;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_qbo_tokens_user_id;
DROP INDEX IF EXISTS idx_qbo_tokens_realm_id;
DROP INDEX IF EXISTS idx_qbo_tokens_user_realm;
DROP INDEX IF EXISTS idx_qbo_tokens_active;
DROP INDEX IF EXISTS idx_qbo_tokens_unique_active;

-- Drop table
DROP TABLE IF EXISTS qbo_tokens;