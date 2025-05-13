import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lokzivnmkuemmhisqrpo.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxva3ppdm5ta3VlbW1oaXNxcnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMTQ2MzgsImV4cCI6MjA2MjU5MDYzOH0.zp2wYshG96mxkR35ri105E5qBXL0bl94dBrQ3kg1gCA';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
