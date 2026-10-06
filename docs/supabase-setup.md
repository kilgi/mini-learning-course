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

Course completion also requires saved feedback. Run this SQL to store one feedback response per student and course:

```sql
create table if not exists public.course_feedback (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  feedback text not null check (length(trim(feedback)) > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

alter table public.course_feedback enable row level security;
grant select, insert, update on public.course_feedback to authenticated;
revoke all on public.course_feedback from anon;

create policy "Users can read their own course feedback"
  on public.course_feedback
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can submit their own course feedback"
  on public.course_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own course feedback"
  on public.course_feedback
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## Admin access and editable course content

Create the admin user in Supabase Dashboard under Authentication with a strong, unique password. Set the user's `app_metadata.role` to `admin` using trusted dashboard tooling or a server-side Supabase Auth Admin API. Never set this role from the browser or store the password or a service-role key in this repository. The admin user's password is never stored in the repo.

Create the course content table in the Supabase SQL Editor:

```sql
create table if not exists public.course_content (
  id text primary key,
  content jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.course_content enable row level security;
grant select on public.course_content to authenticated;
grant insert, update on public.course_content to authenticated;
revoke all on public.course_content from anon;

create policy "Authenticated users can read course content"
  on public.course_content
  for select
  to authenticated
  using (true);
```

After creating all three application tables (`course_content`, `lesson_progress`, and `course_feedback`), run [`security-fix.sql`](security-fix.sql) in the SQL Editor. It enables RLS on those tables and the Supabase-managed `auth.users` table, adds database constraints for lesson IDs and feedback length, and installs the admin-only policies using the verified `app_metadata.role` claim. It deliberately leaves student policies unchanged: students can access only their own progress and feedback rows, while authenticated learners can read course content.

The admin editor stores the course as JSONB and supports editing the course title and description, lesson titles and summaries, and lesson sections, paragraphs, and bullet points. Lesson IDs must remain unchanged because each lesson has a static HTML route. The progress reset permanently removes completion records for the course.

The old progress stored in this browser's `localStorage` is not imported: it has no verified account owner. Clearing browser data signs a user out, but after signing back in, progress remains in the Supabase database. The static lesson HTML is not confidential; client-side redirects provide the sign-in flow, while Supabase policies protect account progress data.

Supabase Auth may need a token refresh after changing `app_metadata`; sign out and back in before testing the admin role. The database policies, not the client-side admin check, are the authorization boundary.