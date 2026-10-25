# cwtext

An app which displays a selection of Jung's texts. Search by keyword or browse by tag, open a paragraph, and export the current results to an ODT document.

Live at https://jqw22.github.io/cwtext/

## How notes are stored

The paragraphs live in a Postgres database on Supabase (project "CGJ"). `supabase/schema.sql` sets up the `notes` table and the security rules: anyone can read, and only accounts listed in `curators` can change notes. The site reads the database directly from the browser using the publishable key in `src/lib/supabase.ts`.

Curators sign in with an emailed link (the "Sign in" button in the header). To give an account editing rights, sign in with it once, then run in the Supabase SQL editor:

```sql
insert into public.curators (user_id) select id from auth.users where email = 'you@example.com';
```

Every night the "Back up notes" GitHub Action saves all notes to `public/notes.json` and redeploys if they changed. The site falls back to that file if the database can't be reached. It can also be run by hand from the Actions tab.

Notes were originally published on Nostr. Old `/naddr1…` links redirect to the same note.

## Archived: private notes

Earlier versions let logged-in users keep their own NIP-44 encrypted notes beside the texts. That feature has been archived for now. The last version that includes it is commit `d3da174`, which can be restored from git history.
