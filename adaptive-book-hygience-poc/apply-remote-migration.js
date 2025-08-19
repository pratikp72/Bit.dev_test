const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Remote Supabase credentials from .env
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Read migration file
const migrationPath = path.join(__dirname, 'src/supabase/migrations/001_create_qbo_tokens_table_clerk.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

async function applyMigration() {
  console.log('Connecting to remote Supabase database...');
  console.log('URL:', supabaseUrl);
  
  try {
    // First, check if the table already exists
    console.log('\nChecking if qbo_tokens table already exists...');
    const { data: existingTable, error: checkError } = await supabase
      .from('qbo_tokens')
      .select('*')
      .limit(0);
    
    if (!checkError) {
      console.log('✓ Table qbo_tokens already exists in the remote database');
      console.log('Migration not needed - table is already present');
      return true;
    }
    
    console.log('Table does not exist yet. Error:', checkError.message);
    
    // Since we can't execute DDL with anon key, let's provide alternative methods
    console.log('\n⚠️  The anon key does not have permissions to create tables.');
    console.log('\nTo apply this migration, you have the following options:\n');
    
    console.log('Option 1: Use the Supabase Dashboard');
    console.log('1. Go to https://supabase.com/dashboard/project/' + supabaseUrl.split('.')[0].split('//')[1]);
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Paste and run the following SQL:\n');
    
    // Output the migration SQL for manual execution
    console.log('--- START OF SQL ---');
    console.log(migrationSQL);
    console.log('--- END OF SQL ---\n');
    
    console.log('Option 2: Use Supabase CLI (requires installation)');
    console.log('1. Install Supabase CLI: npm install -g supabase');
    console.log('2. Link to your project: supabase link --project-ref ' + supabaseUrl.split('.')[0].split('//')[1]);
    console.log('3. Run migration: supabase db push --include-all\n');
    
    console.log('Option 3: Use a service role key');
    console.log('1. Get your service role key from Supabase dashboard');
    console.log('2. Add it to your .env file as SUPABASE_SERVICE_ROLE_KEY');
    console.log('3. Update this script to use the service role key\n');
    
    // Save migration to a file for easy access
    const outputPath = path.join(__dirname, 'qbo_tokens_migration.sql');
    fs.writeFileSync(outputPath, migrationSQL);
    console.log(`Migration SQL has been saved to: ${outputPath}`);
    
    return false;
    
  } catch (error) {
    console.error('Error during migration check:', error);
    return false;
  }
}

// Run the migration
applyMigration().then(success => {
  if (!success) {
    console.log('\n❌ Migration could not be applied automatically.');
    console.log('Please use one of the manual methods above to apply the migration.');
  }
  process.exit(success ? 0 : 1);
});