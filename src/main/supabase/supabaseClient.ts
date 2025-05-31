import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gcjnqikuszmfqnvjxuzv.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjam5xaWt1c3ptZnFudmp4dXp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyODAzNTIsImV4cCI6MjA2Mjg1NjM1Mn0.v3kdkeDvf-YAbN5dvuZEMsruumbSkOkFdGi56ctNYQw';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
