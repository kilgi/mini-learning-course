# System Design

## Overview

This static, multi-page site has a public introduction, a sign-in page, a database-backed student library, a reusable dynamic lesson view, and a teacher studio. Shared presentation is in `css/style.css`; protected pages load their controller from `js/` and the Supabase browser client.

`student.html` reads all published course rows from `course_content`; lesson navigation uses course and lesson IDs in the query string. `teacher.html` creates and edits course JSON through the same table and stores private uploads in Supabase Storage. The original `lesson-1.html` through `lesson-3.html` pages and bundled seed remain only for compatibility with the original course.

## Data and Flow

The main data shapes are:

- **Course:** `id`, `title`, `description`, ordered `lessons`.
- **Lesson:** `id`, `title`, `summary`, `sections` with headings, paragraphs, and optional points, and optional `resources` containing links or Storage object paths.
- **Progress:** `user_id`, `course_id`, `lesson_id`, `completed_at`; it stores completion, not content.

Supabase maps these to `course_content` (`id`, full course JSONB, `updated_at`), `lesson_progress` (one row per user/course/lesson, composite primary key), and `course_feedback` (legacy feedback table). Private PDFs and Word documents live in the `course-materials` Storage bucket and are opened using short-lived signed URLs.

`content + saved progress -> page logic -> screens`. The student library derives statuses, percentage, and next lesson from fetched IDs; the lesson view renders course sections, resources, and completion state. Failed progress saves do not mark the lesson complete.

## Accounts and Access

Supabase Auth supplies each learner's UUID. RLS is enabled on the application tables and anonymous access is revoked. Authenticated users can read course content and materials; only users with the trusted admin app-metadata role can write course content and manage uploads. Learners can read/insert their own progress.

The trusted `app_metadata.role = 'admin'` claim gates the teacher studio. RLS remains the security boundary; role assignment is done in trusted Supabase tooling.

## Design Questions

- **How are lesson routes chosen?** Each lesson opens through the same student page using its database course and lesson IDs; no static route is required for new content.
- **How is content separated from learner progress?** Content is shared by course ID; progress and feedback are separate user-owned rows. Editing content does not clear progress.
- **What happens when stored progress is cleared?** Admin reset deletes course progress and feedback, not content; learners see zero progress on their next load. Clearing Local Storage only signs out and leaves server rows intact.
- **How does the UI avoid stale progress after Complete?** It waits for the insert before updating its in-memory set and control. The primary key prevents duplicate rows; failures show an error without marking completion.

## Why Supabase

Accounts/server storage expand the original version-one scope to provide learner-owned progress and required feedback across devices. Supabase Auth supplies identity; PostgreSQL/RLS persist and isolate records. Old browser-only progress is not imported because it has no verified owner.

Course, progress, and resource data are fetched from Supabase. If progress reads fail, course content remains readable but completion cannot be saved. Authentication is required for student and teacher pages.

## If this grew

The next design step would be to version and validate course content separately from its static routes, then add automated tests for the UI flows and RLS policies. Those capabilities are not part of the current implementation.