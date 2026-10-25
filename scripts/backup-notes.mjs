// Save every note in the database to public/notes.json, which ships with the
// site as a fallback and keeps a copy of the texts in the repository.
// Usage: node scripts/backup-notes.mjs (SUPABASE_URL / SUPABASE_ANON_KEY optional)
import { readFile, writeFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL || 'https://rknovndkowqslhvodqgk.supabase.co';
const key = process.env.SUPABASE_ANON_KEY || 'sb_publishable_GrT7F0e8IzRZ6aoaMPDopg_2yz-hAdM';
const out = process.env.NOTES_FILE || 'public/notes.json';

const COLUMNS = 'id,slug,para,sort_order,body,tags,published_at,created_at,updated_at';
const PAGE_SIZE = 1000;

const rows = [];
for (let offset = 0; ; offset += PAGE_SIZE) {
  const params = new URLSearchParams({
    select: COLUMNS,
    order: 'sort_order.asc.nullslast,slug.asc',
    offset: String(offset),
    limit: String(PAGE_SIZE),
  });
  const res = await fetch(`${url}/rest/v1/notes?${params}`, { headers: { apikey: key } });
  if (!res.ok) throw new Error(`Database returned ${res.status}: ${await res.text()}`);
  const page = await res.json();
  rows.push(...page);
  if (page.length < PAGE_SIZE) break;
}

// An empty result most likely means something is wrong; keep the last good copy
if (rows.length === 0) {
  console.log('Database returned no notes; leaving the backup unchanged');
  process.exit(0);
}

// One note per line, so the git history shows which notes changed
const json = `[\n${rows.map((row) => JSON.stringify(row)).join(',\n')}\n]\n`;
const previous = await readFile(out, 'utf8').catch(() => '');
if (json === previous) {
  console.log(`${rows.length} notes, unchanged`);
} else {
  await writeFile(out, json);
  console.log(`${rows.length} notes written to ${out}`);
}
