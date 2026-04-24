import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://console.swordbase.cloud';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3MjA2MTA0OCwiZXhwIjoyNTI0NjA4MDAwLCJyb2xlIjoiYW5vbiJ9.y_znR577w2B0r-gKxzVa9kD5KvlZqPR9L8IZww0GoWg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
