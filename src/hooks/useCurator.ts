import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * The signed-in account, if any, and whether it may edit notes.
 * Being signed in isn't enough: the account must be listed in `curators`.
 */
export function useCurator() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  const { data: isCurator = false, error: checkError } = useQuery({
    queryKey: ['curator', userId],
    queryFn: async () => {
      const { data, error } = await supabase!.rpc('is_curator');
      if (error) throw error;
      return data === true;
    },
    enabled: !!supabase && !!userId,
    // Checked again when the tab regains focus, so being added to
    // `curators` takes effect without signing in again
    staleTime: 30 * 1000,
  });

  return {
    session,
    userId,
    email: session?.user.email,
    isCurator: !!userId && isCurator,
    /** Why the curator check failed, as opposed to the account simply not being a curator */
    checkError: checkError instanceof Error ? checkError.message : undefined,
  };
}

/** Email a one-time sign-in link that returns to the app */
export async function sendSignInLink(email: string): Promise<void> {
  if (!supabase) throw new Error('No note database is configured');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}
