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

Create the admin account in Supabase Authentication with the email `admin@gmail.com` and set its password to `12345678`. Do not place the password in this static site's files. The admin page signs in through the same Supabase Auth system as students, and database policies grant admin access only to a session whose verified email claim is `admin@gmail.com`.

Run this SQL in the Supabase SQL Editor to enable course editing and progress removal:

```sql
create table if not exists public.course_content (
  id text primary key,
  content jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.course_content enable row level security;
grant select on public.course_content to authenticated;
grant insert, update on public.course_content to authenticated;

create policy "Authenticated users can read course content"
  on public.course_content
  for select
  to authenticated
  using (true);

create policy "Admins can create course content"
  on public.course_content
  for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') = 'admin@gmail.com');

create policy "Admins can update course content"
  on public.course_content
  for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'admin@gmail.com');

grant delete on public.lesson_progress to authenticated;
grant delete on public.course_feedback to authenticated;

create policy "Admins can read all lesson progress"
  on public.lesson_progress
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@gmail.com');

create policy "Admins can delete lesson progress"
  on public.lesson_progress
  for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@gmail.com');

create policy "Admins can delete course feedback"
  on public.course_feedback
  for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@gmail.com');
```

The admin editor stores the course as JSONB and supports editing the course title and description, lesson titles and summaries, and lesson sections, paragraphs, and bullet points. Lesson IDs must remain unchanged because each lesson has a static HTML route. The progress reset permanently removes completion records for the course.

The old progress stored in this browser's `localStorage` is not imported: it has no verified account owner. Clearing browser data signs a user out, but after signing back in, progress remains in the Supabase database. The static lesson HTML is not confidential; client-side redirects provide the sign-in flow, while Supabase policies protect account progress data.