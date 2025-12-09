import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dbligsjxglessenqsewe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRibGlnc2p4Z2xlc3NlbnFzZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMjYwMTIsImV4cCI6MjA3NjYwMjAxMn0.GHi-18a0vX7hToQyh3nzBWDrFtbwnBggYIQEf_eAvJo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);