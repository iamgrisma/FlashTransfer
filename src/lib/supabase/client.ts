
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Create a singleton Supabase client for the browser
export const createClient = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
