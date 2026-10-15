begin;

alter table public.course_content
    add column if not exists teacher_id uuid;

alter table public.course_content
    alter column teacher_id set default auth.uid();

alter table public.course_content
    add column if not exists published boolean not null default false;

alter table public.course_content
    alter column published set default false;

update public.course_content
set published = false
where published is null;

alter table public.course_content
    alter column published set not null;

comment on column public.course_content.teacher_id is
    'Owner of this course. For existing rows, set teacher_id manually in the SQL Editor, then rerun this migration to enforce NOT NULL.';

do $$
begin
    if exists (
        select 1
        from public.course_content
        where teacher_id is null
    ) then
        raise notice 'Set teacher_id on every existing course_content row, then rerun this migration to enforce NOT NULL.';
    else
        alter table public.course_content
            alter column teacher_id set not null;
    end if;
end
$$;

alter table public.course_content enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.course_feedback enable row level security;

alter table public.lesson_progress
    drop constraint if exists lesson_progress_course_lesson_allowed_check;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'course_feedback_feedback_max_length_check'
            and conrelid = 'public.course_feedback'::regclass
    ) then
        alter table public.course_feedback
            add constraint course_feedback_feedback_max_length_check
            check (char_length(feedback) <= 2000);
    end if;
end
$$;

do $$
declare
    policy_row record;
begin
    for policy_row in
        select schemaname, tablename, policyname
        from pg_catalog.pg_policies
        where schemaname = 'public'
            and tablename in ('course_content', 'lesson_progress', 'course_feedback')
    loop
        execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
    end loop;
end
$$;

revoke all on public.course_content from anon;
revoke all on public.lesson_progress from anon;
revoke all on public.course_feedback from anon;
grant select, insert, update, delete on public.course_content to authenticated;
grant select, insert, delete on public.lesson_progress to authenticated;
grant select, insert, update, delete on public.course_feedback to authenticated;

create policy "Users can read visible course content"
    on public.course_content
    for select
    to authenticated
    using (
        published
        or teacher_id = auth.uid()
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

create policy "Teachers can create owned course content"
    on public.course_content
    for insert
    to authenticated
    with check (
        (auth.jwt() -> 'app_metadata' ->> 'role') in ('teacher', 'admin')
        and teacher_id = auth.uid()
    );

create policy "Teachers can update owned course content"
    on public.course_content
    for update
    to authenticated
    using (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        or (
            (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
            and teacher_id = auth.uid()
        )
    )
    with check (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        or (
            (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
            and teacher_id = auth.uid()
        )
    );

create policy "Teachers can delete owned course content"
    on public.course_content
    for delete
    to authenticated
    using (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        or (
            (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
            and teacher_id = auth.uid()
        )
    );

create policy "Users and course owners can read lesson progress"
    on public.lesson_progress
    for select
    to authenticated
    using (
        user_id = auth.uid()
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        or (
            (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
            and exists (
                select 1
                from public.course_content as course
                where course.id = lesson_progress.course_id
                    and course.teacher_id = auth.uid()
            )
        )
    );

create policy "Users can record their own lesson progress"
    on public.lesson_progress
    for insert
    to authenticated
    with check (user_id = auth.uid());

create policy "Admins can delete lesson progress"
    on public.lesson_progress
    for delete
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Users and admins can read course feedback"
    on public.course_feedback
    for select
    to authenticated
    using (
        user_id = auth.uid()
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

create policy "Users can submit their own course feedback"
    on public.course_feedback
    for insert
    to authenticated
    with check (user_id = auth.uid());

create policy "Users can update their own course feedback"
    on public.course_feedback
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "Admins can delete course feedback"
    on public.course_feedback
    for delete
    to authenticated
    using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'course-materials',
    'course-materials',
    false,
    20971520,
    array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can read course materials" on storage.objects;
drop policy if exists "Admins can upload course materials" on storage.objects;
drop policy if exists "Admins can delete course materials" on storage.objects;
drop policy if exists "Users can read visible course materials" on storage.objects;
drop policy if exists "Teachers can upload owned course materials" on storage.objects;
drop policy if exists "Teachers can delete owned course materials" on storage.objects;

create policy "Users can read visible course materials"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'course-materials'
        and exists (
            select 1
            from public.course_content as course
            cross join lateral jsonb_array_elements(
                case
                    when jsonb_typeof(course.content -> 'lessons') = 'array' then course.content -> 'lessons'
                    else '[]'::jsonb
                end
            ) as lesson(value)
            cross join lateral jsonb_array_elements(
                case
                    when jsonb_typeof(lesson.value -> 'resources') = 'array' then lesson.value -> 'resources'
                    else '[]'::jsonb
                end
            ) as resource(value)
            where resource.value ->> 'path' = storage.objects.name
                and (
                    course.published
                    or course.teacher_id = auth.uid()
                    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
                )
        )
    );

create policy "Teachers can upload owned course materials"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'course-materials'
        and (
            (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
            or (
                (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
                and (storage.foldername(name))[1] = auth.uid()::text
            )
        )
    );

create policy "Teachers can delete owned course materials"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'course-materials'
        and (
            (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
            or (
                (auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
                and (storage.foldername(name))[1] = auth.uid()::text
            )
        )
    );

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
        raise exception 'RLS must be enabled on all three application tables.';
    end if;
end
$$;

create or replace function public.delete_owned_course(p_course_id text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
    course_owner uuid;
begin
    select course.teacher_id
    into course_owner
    from public.course_content as course
    where course.id = p_course_id
    for update;

    if not found then
        raise exception 'Course not found or you do not have permission to delete it.'
            using errcode = '42501';
    end if;

    if course_owner is distinct from auth.uid()
        and (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
        raise exception 'Course not found or you do not have permission to delete it.'
            using errcode = '42501';
    end if;

    delete from public.lesson_progress
    where course_id = p_course_id;

    delete from public.course_feedback
    where course_id = p_course_id;

    delete from public.course_content
    where id = p_course_id;
end
$function$;

revoke all on function public.delete_owned_course(text) from public, anon, authenticated;
grant execute on function public.delete_owned_course(text) to authenticated;

commit;