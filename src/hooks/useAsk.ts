import { useMutation } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/** Claude's answer to a reader's question (see supabase/functions/ask) */
export interface AskAnswer {
  summary: string;
  /** Chosen paragraphs by note slug, best first, each with why it fits */
  passages: { id: string; why: string }[];
  /** Questions the reader has left today */
  remaining: number;
}

/** Ask Claude which paragraphs answer a question. Needs a signed-in reader. */
export function useAsk() {
  return useMutation({
    mutationFn: async (question: string): Promise<AskAnswer> => {
      if (!supabase) throw new Error('This copy of the site has no database.');
      const { data, error } = await supabase.functions.invoke<AskAnswer>('ask', { body: { question } });
      if (error) {
        // The function explains what went wrong in the body
        if (error instanceof FunctionsHttpError) {
          const body = await error.context.json().catch(() => undefined);
          if (typeof body?.error === 'string') throw new Error(body.error);
        }
        throw new Error('Ask isn’t available right now. Try again later.');
      }
      return data!;
    },
  });
}
