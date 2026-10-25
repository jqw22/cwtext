import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The CGJ project. The publishable key is meant for browsers: row-level
// security in supabase/schema.sql decides who may write, not the key.
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY override these, e.g. for a test project.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://rknovndkowqslhvodqgk.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_GrT7F0e8IzRZ6aoaMPDopg_2yz-hAdM';

/** The note database, or undefined when this build has none configured */
export const supabase: SupabaseClient | undefined = url && key ? createClient(url, key) : undefined;
