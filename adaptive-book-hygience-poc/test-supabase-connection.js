// Test script to verify local Supabase connection
import { supabase } from './src/lib/supabaseConnect.ts';

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    
    // Test a simple query to verify connection
    const { data, error } = await supabase
      .from('qbo_tokens')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
    } else {
      console.log('Supabase connection successful!');
      console.log('Query result:', data);
    }
  } catch (err) {
    console.error('Test failed:', err);
  }
}

// Run test when DOM is loaded
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', testConnection);
}