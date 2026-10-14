# System Design

## Overview

The app is a static multi-page site backed by Supabase. `index.html` is the public entry page, `login.html` handles student account creation/sign-in and teacher sign-in, `student.html` renders the database-backed library and lesson view, and `teacher.html` provides course authoring. Browser code uses the Supabase client configured in `js/supabase-config.js`; there is no application server in this repository.

## Data Model

- **Course content:** `course_content` stores one row per course. `id` is the text primary key, `content` is JSONB containing the course object, and `updated_at` records the last save. The course object has an ID, title, description, and ordered lessons.
- **Lesson:** Each lesson is nested in the course JSON and has an ID, title, summary, sections, and resources. Sections contain headings, paragraphs, and optional points. Resources are external URLs or paths to uploaded Storage objects.
- **Progress:** `lesson_progress` stores `user_id`, `course_id`, `lesson_id`, and `completed_at`. Its composite primary key permits at most one completion row for a user/course/lesson tuple. The user ID references `auth.users`; course and lesson IDs are not foreign keys to nested JSON content.
- **Resources:** Uploaded PDF and Word files are in the private `course-materials` Storage bucket. The client requests short-lived signed URLs to open uploaded files.
- **Feedback:** Setup SQL also creates `course_feedback`, with one row per user and course. The current browser application does not read or write this table.

## Roles and Ownership

Supabase Auth supplies the authenticated user ID. Student mode is available to signed-in accounts; teacher mode requires the trusted JWT claim `app_metadata.role = 'admin'`. The role is assigned through trusted Supabase tooling, not by the browser.

Students can read course content and authenticated users can read course materials. RLS scopes progress and feedback access to the row's `user_id`; trusted admins can read all progress and delete progress/feedback under the installed policies. Admin-role users can insert and update course rows and upload/delete course files.

There is no course-owner column or per-teacher course policy. Therefore all accounts with the trusted admin role can edit every course; teacher A is not isolated from teacher B's courses. There is also no draft/published field: a saved course is readable by students. These are current schema/policy limitations, not implemented capabilities.

## Data Flow

1. The login page signs users in through Supabase Auth. Teacher login additionally checks the trusted role claim and routes authorized accounts to the teacher studio.
2. The student page fetches `course_content` and the current user's `lesson_progress`. Course and lesson IDs in the query string select the active lesson; the browser builds the catalog and lesson view from the returned course JSON.
3. The student view calculates completion counts and the next lesson from progress rows that match the current course's lesson IDs. Marking a lesson complete inserts a progress row.
4. The teacher page reads course rows, edits the course JSON, uploads resources to Storage, and upserts the course row. Uploaded resources are displayed through signed URLs; external resources are limited to HTTP(S) links.

## Stale Progress and Duplicate Completion

Progress is stored independently from the nested lesson JSON. When rendering a course, the student code builds the current set of lesson IDs and counts only progress rows whose lesson IDs still exist in that set. If a lesson is removed from a course, its old progress row is not automatically deleted, but it no longer contributes to displayed completion or next-lesson selection. The composite primary key prevents duplicate completion rows; the UI also disables the completion button after success. A duplicate insert response is treated as already completed.

## Database and Auth Failures

If Supabase is not configured, the student page shows a configuration status and the login controls are disabled. If the student course query fails, the page shows an error and does not substitute bundled course content. If only the progress query fails, courses still render with progress treated as empty for that load and a warning is shown. A failed completion insert leaves the lesson incomplete and displays an error. Teacher query/save/upload failures are shown in the teacher status area. If the current-user lookup fails, the student page redirects to sign-in; the teacher page denies access unless it can verify an authorized session.

## Security Boundary

RLS is enabled on `course_content`, `lesson_progress`, and `course_feedback`, and anonymous table access is revoked. The policies installed by `docs/supabase-setup.md` and `docs/security-fix.sql` allow authenticated course reads, user-scoped progress/feedback access, and trusted-admin course writes. Authenticated users can read objects in the private course-material bucket; only trusted admins can upload or delete them. The client-side teacher check is for the interface; database and Storage policies are the authorization boundary.