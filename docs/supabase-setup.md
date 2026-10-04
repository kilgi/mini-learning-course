# Supabase setup

The site uses Supabase Auth for accounts and the authenticated user's UUID as the progress owner. Lesson completion is stored in PostgreSQL, not browser storage. The browser only receives the Supabase publishable/anon key; never put a service-role key in this project.

## Configure the project

1. Create a Supabase project and enable Email authentication. Keep email confirmation enabled for production.
2. In the Supabase SQL Editor, run:

```sql
create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  lesson_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, course_id, lesson_id)
);

alter table public.lesson_progress enable row level security;

grant select, insert on public.lesson_progress to authenticated;
revoke all on public.lesson_progress from anon;

create policy "Users can read their own lesson progress"
  on public.lesson_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can record their own lesson progress"
  on public.lesson_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);
```

3. Copy the Project URL and publishable/anon key from the Supabase project API settings into `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `js/supabase-config.js`.
4. For local development, run `python3 -m http.server 8000` from the project root and open `http://localhost:8000/login.html`. Add `http://localhost:8000/**` and your production site's URL under Supabase Auth URL Configuration; set the Site URL for the environment you are testing.
5. Serve the deployed site over HTTPS.
6. Configure database backups/retention in Supabase for the project's needs.

The primary key prevents a user from recording the same lesson twice. Row-level security limits reads and inserts to rows whose `user_id` matches the authenticated Supabase user. The course completion count is calculated from that user's lesson rows.

The old progress stored in this browser's `localStorage` is not imported: it has no verified account owner. Clearing browser data signs a user out, but after signing back in, progress remains in the Supabase database. The static lesson HTML is not confidential; client-side redirects provide the sign-in flow, while Supabase policies protect account progress data.