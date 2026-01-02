import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wfwtcllhqacrisgphekc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmd3RjbGxocWFjcmlzZ3BoZWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODQwNTIsImV4cCI6MjA4Mjk2MDA1Mn0.GfQfTMBNbVDZdg_jhvZ04RhEFas4p5A0iQAObc9bzGM';

export const supabase = createClient(supabaseUrl, supabaseKey);