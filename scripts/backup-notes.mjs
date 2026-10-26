// Save every note in the database to public/notes.json, and the volumes and
// works to public/works.json. Both ship with the site as a fallback and keep a
// copy of the texts in the repository.
// Usage: node scripts/backup-notes.mjs (SUPABASE_URL / SUPABASE_ANON_KEY optional)
import { readFile, writeFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL || 'https://rknovndkowqslhvodqgk.supabase.co';
const key = process.env.SUPABASE_ANON_KEY || 'sb_publishable_GrT7F0e8IzRZ6aoaMPDopg_2yz-hAdM';
const out = process.env.NOTES_FILE || 'public/notes.json';
const worksOut = process.env.WORKS_FILE || 'public/works.json';

const COLUMNS = 'id,slug,para,sort_order,body,tags,published_at,created_at,updated_at';
const PAGE_SIZE = 1000;

/** Every row of a table, in the given order */
async function fetchAll(table, select, order) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({ select, order, offset: String(offset), limit: String(PAGE_SIZE) });
    const res = await fetch(`${url}/rest/v1/${table}?${params}`, { headers: { apikey: key } });
    if (!res.ok) throw new Error(`Database returned ${res.status} for ${table}: ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** One row per line, so the git history shows which rows changed */
const toLines = (rows) => `[\n${rows.map((row) => JSON.stringify(row)).join(',\n')}\n]`;

/** Write the file only if it changed */
async function save(file, json, label) {
  const previous = await readFile(file, 'utf8').catch(() => '');
  if (json === previous) {
    console.log(`${label}, unchanged`);
  } else {
    await writeFile(file, json);
    console.log(`${label} written to ${file}`);
  }
}

const VOLUME_COLUMNS = 'number,sort_order,title,year_published,notes';
const WORK_COLUMNS = 'id,title,original_title,original_language,kind,volume,para_from,para_to,year_written,'
  + 'year_written_note,year_first_published,year_first_published_note,first_published_in,revisions,notes,tag';

// The works tables come from supabase/works.sql; until it has been run there is nothing to save
try {
  const volumes = await fetchAll('volumes', VOLUME_COLUMNS, 'sort_order.asc');
  const works = await fetchAll('works', WORK_COLUMNS, 'title.asc,id.asc');
  if (volumes.length > 0) {
    await save(worksOut, `{\n"volumes": ${toLines(volumes)},\n"works": ${toLines(works)}\n}\n`, `${works.length} works`);
  }
} catch (error) {
  console.log(`Works not backed up: ${error.message}`);
}

const rows = await fetchAll('notes', COLUMNS, 'sort_order.asc.nullslast,slug.asc');

// An empty result most likely means something is wrong; keep the last good copy
if (rows.length === 0) {
  console.log('Database returned no notes; leaving the backup unchanged');
  process.exit(0);
}

await save(out, `${toLines(rows)}\n`, `${rows.length} notes`);
