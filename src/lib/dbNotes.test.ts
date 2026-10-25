import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { fetchDbNotes } from './dbNotes';

/** A client whose requests are answered from `total` fake rows, honouring offset and limit */
function fakeClient(total: number) {
  const requests: string[] = [];
  const client = createClient('https://example.supabase.co', 'key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input) => {
        requests.push(String(input));
        const params = new URL(String(input)).searchParams;
        const from = Number(params.get('offset') ?? 0);
        const to = Math.min(from + Number(params.get('limit') ?? 1000), total);
        const rows = Array.from({ length: Math.max(0, to - from) }, (_, i) => ({
          slug: `n${from + i}`,
        }));
        return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
      },
    },
  });
  return { client, requests };
}

describe('fetchDbNotes', () => {
  it('pages past the 1000-row response cap', async () => {
    const { client, requests } = fakeClient(2500);
    const rows = await fetchDbNotes(client, AbortSignal.timeout(1000));
    expect(rows).toHaveLength(2500);
    expect(requests).toHaveLength(3);
  });

  it('asks for the notes table in sort order', async () => {
    const { client, requests } = fakeClient(3);
    await fetchDbNotes(client, AbortSignal.timeout(1000));
    expect(requests[0]).toContain('/rest/v1/notes?');
    expect(decodeURIComponent(requests[0])).toContain('order=sort_order.asc.nullslast,slug.asc');
  });
});
