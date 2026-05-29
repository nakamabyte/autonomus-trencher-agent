import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use the service role key to bypass RLS and allow admin actions like inserting/deleting users
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
