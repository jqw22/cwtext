import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { deleteDbWork, fetchDbWorks, saveDbWork, type WorkInput, type WorkRow, type WorksData } from '@/lib/dbWorks';
import { workOfNote } from '@/lib/works';
import type { StructuredNote } from '@/hooks/useStructuredNotes';

/** The nightly copy of the works that ships with the site, or undefined if missing */
async function fetchWorksFromBackup(signal: AbortSignal): Promise<WorksData | undefined> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}works.json`, { signal });
    if (!res.ok) return undefined;
    const data: WorksData = await res.json();
    return Array.isArray(data?.volumes) && Array.isArray(data?.works) ? data : undefined;
  } catch (error) {
    if (signal.aborted) throw error;
    return undefined;
  }
}

const WORKS_KEY = ['works'];

/**
 * The Collected Works volumes and Jung's works: from the database, then the
 * nightly backup. `fromBackup` marks the backup, which can't be edited.
 */
export function useWorks() {
  return useQuery<WorksData & { fromBackup: boolean }>({
    queryKey: WORKS_KEY,
    queryFn: async ({ signal }) => {
      if (supabase) {
        try {
          const data = await fetchDbWorks(supabase, AbortSignal.any([signal, AbortSignal.timeout(15000)]));
          if (data.volumes.length > 0) return { ...data, fromBackup: false };
        } catch (error) {
          if (signal.aborted) throw error;
          console.warn('Works database unavailable, loading the backup', error);
        }
      }
      const backup = await fetchWorksFromBackup(signal);
      if (!backup) throw new Error('Works could not be loaded');
      return { ...backup, fromBackup: true };
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Add or update a work. Only works for a signed-in curator. */
export function useSaveWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (work: WorkInput) => {
      if (!supabase) throw new Error('No database is configured');
      return saveDbWork(supabase, work);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKS_KEY }),
  });
}

export function useDeleteWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!supabase) throw new Error('No database is configured');
      return deleteDbWork(supabase, id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKS_KEY }),
  });
}

/**
 * The works, with each note's work and how many notes each work and volume
 * has. `workOf` gives a note's work id (see workOfNote).
 */
export function useNoteWorks(notes: StructuredNote[] | undefined) {
  const { data } = useWorks();

  return useMemo(() => {
    const works = data?.works ?? [];
    const volumes = data?.volumes ?? [];
    const workById = new Map<string, WorkRow>(works.map((w) => [w.id, w]));
    const workOf = workOfNote(works);
    const notesPerWork = new Map<string, number>();
    const notesPerVolume = new Map<string, number>();
    for (const note of notes ?? []) {
      const id = workOf(note);
      if (!id) continue;
      notesPerWork.set(id, (notesPerWork.get(id) ?? 0) + 1);
      const volume = workById.get(id)?.volume;
      if (volume) notesPerVolume.set(volume, (notesPerVolume.get(volume) ?? 0) + 1);
    }
    return { volumes, works, workById, workOf, notesPerWork, notesPerVolume, fromBackup: data?.fromBackup };
  }, [data, notes]);
}
