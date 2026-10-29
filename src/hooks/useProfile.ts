import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface Profile {
  user_id: string;
  display_name: string | null;
  created_at: string;
}

/** The signed-in reader's own profile; null if the row is missing (profiles.sql not run yet) */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('profiles')
        .select('user_id, display_name, created_at')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!supabase && !!userId,
  });
}

export function useUpdateProfile(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) => {
      const trimmed = displayName.trim();
      const { error } = await supabase!
        .from('profiles')
        .update({ display_name: trimmed || null })
        .eq('user_id', userId!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
  });
}

/** Close the signed-in account for good, then sign out */
export async function deleteMyAccount(): Promise<void> {
  if (!supabase) throw new Error('No note database is configured');
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut();
}
