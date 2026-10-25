import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const key: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** The note database, or undefined when this build has none configured */
export const supabase: SupabaseClient | undefined = url && key ? createClient(url, key) : undefined;
