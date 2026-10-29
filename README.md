# cwtext

An app which displays a selection of Jung's texts. Search by keyword or browse by tag, open a paragraph, and export the current results to an ODT document.

Live at https://jqw22.github.io/cwtext/

## How notes are stored

The paragraphs live in a Postgres database on Supabase (project "CGJ"). `supabase/schema.sql` sets up the `notes` table and the security rules: anyone can read, and only accounts listed in `curators` can change notes. The site reads the database directly from the browser using the publishable key in `src/lib/supabase.ts`.

Readers can have their own accounts (the "Sign in" button in the header). `supabase/profiles.sql` gives each account a private profile (an optional display name) and lets readers close their own account from the Account dialog. An ordinary account can't change the shared notes. To give an account editing rights, sign in with it once, then run in the Supabase SQL editor:

```sql
insert into public.curators (user_id) select id from auth.users where email = 'you@example.com';
```

Readers can sign in with a password or an emailed link. To add a reader by hand, open Authentication → Users → Add user → Create new user in the Supabase dashboard, enter their email and a password, and tick "Auto confirm". No email is sent. They can change the password in the Account dialog.

Supabase's built-in email only delivers to the project's own team members, a few messages an hour. Letting readers sign up for themselves with emailed links needs a custom SMTP sender (Authentication → Emails → SMTP settings) and "Allow new users to sign up" turned on (Authentication → Sign In / Providers).

## Works

The Works page (`/works`) lists Jung's essays and books with when each was written and first published, its original title and language, and its volume and paragraph range in the Collected Works. It can be ordered by volume or by date. `supabase/works.sql` sets up the `volumes` and `works` tables, seeded with the 20 volumes and the essays that already have notes. A work is matched to its notes by the text (tag) they carry. Curators add and edit works on that page.

Every night the "Back up notes" GitHub Action saves all notes to `public/notes.json`, and the volumes and works to `public/works.json`, and redeploys if they changed. The site falls back to those files if the database can't be reached. It can also be run by hand from the Actions tab.

Notes were originally published on Nostr. Old `/naddr1…` links redirect to the same note.

## Search

Visitors who aren't signed in can only read, by choosing a volume and text. Signed-in readers also get keyword search and **Ask**, where Claude reads every paragraph and picks the ones that answer a question in plain words, saying why each fits. Ask runs in the `ask` Supabase Edge Function (`supabase/functions/ask/index.ts`), so the Claude API key never reaches the browser. Each reader can ask 20 questions a day, counted by `supabase/ask.sql`.

To set it up:

1. Run `supabase/ask.sql` in the SQL editor.
2. Create an API key at console.anthropic.com.
3. In Supabase, go to Edge Functions → Secrets and add `ANTHROPIC_API_KEY` with that key. Optionally add `ASK_DAILY_LIMIT` to change the limit of 20.
4. Go to Edge Functions → Deploy a new function → Via editor, name it `ask`, paste in `supabase/functions/ask/index.ts` and deploy. Keep "Verify JWT" on. With the Supabase CLI, `supabase functions deploy ask` does the same.

Redeploy the function after any change to that file.

## Archived: private notes

Earlier versions let logged-in users keep their own NIP-44 encrypted notes beside the texts. That feature has been archived for now. The last version that includes it is commit `d3da174`, which can be restored from git history.
