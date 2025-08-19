-- Migration: Create qbo_tokens table
-- Description: Table to store QuickBooks OAuth tokens for authenticated users (Clerk version)
-- Created: 2025-01-07
-- Note: Row Level Security (RLS) is NOT enabled on this table because authentication
-- is handled by Clerk instead of Supabase Auth. Access control should be implemented
-- at the application level using Clerk's user IDs.

-- Create the qbo_tokens table
CREATE TABLE IF NOT EXISTS qbo_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  realm_id TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  expires_in INTEGER DEFAULT 3600,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_qbo_tokens_user_id ON qbo_tokens(user_id);
CREATE INDEX idx_qbo_tokens_realm_id ON qbo_tokens(realm_id);
CREATE INDEX idx_qbo_tokens_user_realm ON qbo_tokens(user_id, realm_id);
CREATE INDEX idx_qbo_tokens_active ON qbo_tokens(is_active) WHERE is_active = true;

-- Add a unique constraint to ensure one active token per user per realm
CREATE UNIQUE INDEX idx_qbo_tokens_unique_active ON qbo_tokens(user_id, realm_id) WHERE is_active = true;

-- Create an updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_qbo_tokens_updated_at BEFORE UPDATE ON qbo_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE qbo_tokens IS 'Stores QuickBooks OAuth tokens for authenticated users';
COMMENT ON COLUMN qbo_tokens.user_id IS 'Clerk user ID';
COMMENT ON COLUMN qbo_tokens.access_token IS 'QuickBooks OAuth access token (encrypted)';
COMMENT ON COLUMN qbo_tokens.refresh_token IS 'QuickBooks OAuth refresh token (encrypted)';
COMMENT ON COLUMN qbo_tokens.realm_id IS 'QuickBooks company/realm ID';
COMMENT ON COLUMN qbo_tokens.token_type IS 'OAuth token type (usually Bearer)';
COMMENT ON COLUMN qbo_tokens.expires_in IS 'Token expiration time in seconds';
COMMENT ON COLUMN qbo_tokens.is_active IS 'Whether this token is currently active';