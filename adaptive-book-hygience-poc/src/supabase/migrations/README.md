# Supabase Migrations

This directory contains SQL migration files for the Supabase database schema.

## Migration Files

### 001_create_qbo_tokens_table.sql
Creates the `qbo_tokens` table for storing QuickBooks OAuth tokens with:
- Proper indexes for performance on `user_id`, `realm_id`, and combined lookups
- Row-level security (RLS) policies to ensure users can only access their own tokens
- Automatic `updated_at` timestamp updates via trigger
- Unique constraint to ensure only one active token per user per realm

## How to Apply Migrations

1. **Via Supabase Dashboard:**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Copy and paste the migration SQL
   - Execute the query

2. **Via Supabase CLI:**
   ```bash
   supabase db push
   ```

3. **Direct Connection:**
   ```bash
   psql -h <your-supabase-host> -U postgres -d postgres -f 001_create_qbo_tokens_table.sql
   ```

## Rollback

To rollback a migration, use the corresponding rollback file:
```bash
psql -h <your-supabase-host> -U postgres -d postgres -f 001_create_qbo_tokens_table_rollback.sql
```

## Important Notes

- Always test migrations in a development environment first
- The table includes RLS policies that depend on Supabase Auth
- Tokens should be encrypted before storage (handled in application code)
- The unique constraint ensures data integrity for active tokens