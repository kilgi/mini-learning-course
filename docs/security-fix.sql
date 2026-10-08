    begin;

    alter table public.course_content enable row level security;
    alter table public.lesson_progress enable row level security;
    alter table public.course_feedback enable row level security;

    do $$
    begin
        if not exists (
            select 1 from pg_constraint
            where conname = 'course_feedback_feedback_max_length_check'
                and conrelid = 'public.course_feedback'::regclass
        ) then
            alter table public.course_feedback
                add constraint course_feedback_feedback_max_length_check
                check (char_length(feedback) <= 2000);
        end if;

        if not exists (
            select 1 from pg_constraint
            where conname = 'lesson_progress_course_lesson_allowed_check'
                and conrelid = 'public.lesson_progress'::regclass
        ) then
            alter table public.lesson_progress
                add constraint lesson_progress_course_lesson_allowed_check
                check (
                    course_id = 'intro-to-ai'
                    and lesson_id in ('lesson-1', 'lesson-2', 'lesson-3')
                );
        end if;
    end
    $$;

    revoke all on public.course_content from anon;
    revoke all on public.lesson_progress from anon;
    revoke all on public.course_feedback from anon;
    grant select, insert, update on public.course_content to authenticated;
    grant select, insert on public.lesson_progress to authenticated;
    grant delete on public.lesson_progress to authenticated;
    grant select, insert, update, delete on public.course_feedback to authenticated;

    drop policy if exists "Admins can create course content" on public.course_content;
    drop policy if exists "Admins can update course content" on public.course_content;
    drop policy if exists "Admins can read all lesson progress" on public.lesson_progress;
    drop policy if exists "Admins can delete lesson progress" on public.lesson_progress;
    drop policy if exists "Admins can delete course feedback" on public.course_feedback;

    create policy "Admins can create course content"
        on public.course_content
        for insert
        to authenticated
        with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

    create policy "Admins can update course content"
        on public.course_content
        for update
        to authenticated
        using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
        with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

    create policy "Admins can read all lesson progress"
        on public.lesson_progress
        for select
        to authenticated
        using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

    create policy "Admins can delete lesson progress"
        on public.lesson_progress
        for delete
        to authenticated
        using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

    create policy "Admins can delete course feedback"
        on public.course_feedback
        for delete
        to authenticated
        using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

    do $$
    declare
        secured_table_count integer;
    begin
        select count(*) into secured_table_count
        from pg_catalog.pg_class as relation
        join pg_catalog.pg_namespace as schema on schema.oid = relation.relnamespace
        where relation.relkind in ('r', 'p')
            and relation.relrowsecurity
            and (schema.nspname, relation.relname) in (
                
                ('public', 'course_content'),
                ('public', 'lesson_progress'),
                ('public', 'course_feedback')
            );

        if secured_table_count <> 3 then
            raise exception 'LS must be enabled on all three application tables.';
        end if;
    end
    $$;

    commit;