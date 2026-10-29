import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Annotation, NoteRange } from '@/lib/annotations';

const COLUMNS = 'id, note_slug, quote, start_offset, end_offset, body, created_at, updated_at';

/** The signed-in reader's margin notes, all of them (a reader's own notes are few), grouped by paragraph */
export function useAnnotations(userId: string | undefined) {
  const query = useQuery({
    queryKey: ['annotations', userId],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('annotations')
        .select(COLUMNS)
        .order('created_at');
      if (error) throw error;
      return data as Annotation[];
    },
    enabled: !!supabase && !!userId,
  });

  const byNote = useMemo(() => {
    const map = new Map<string, Annotation[]>();
    for (const a of query.data ?? []) map.set(a.note_slug, [...(map.get(a.note_slug) ?? []), a]);
    return map;
  }, [query.data]);

  return { ...query, byNote };
}

/** Add, change and delete the reader's own margin notes */
export function useAnnotationActions() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['annotations'] });

  const add = useMutation({
    mutationFn: async ({ noteSlug, range, body }: { noteSlug: string; range: NoteRange | null; body: string }) => {
      const { error } = await supabase!.from('annotations').insert({
        note_slug: noteSlug,
        quote: range?.quote ?? '',
        start_offset: range?.start ?? null,
        end_offset: range?.end ?? null,
        body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess,
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase!.from('annotations').update({ body: body.trim() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase!.from('annotations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess,
  });

  return { add, update, remove };
}
