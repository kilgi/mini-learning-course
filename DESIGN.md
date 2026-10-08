# System Design

## Overview

This static, multi-page site has a sign-in page, a course overview, three fixed lesson routes, and an admin page. Shared presentation is in `css/style.css`; each page loads its controller from `js/` and the Supabase browser client.

`js/data.js` bundles the `COURSE` seed. `js/storage.js` reads an optional matching `course_content` row and falls back to the seed on missing data or read failure. Admins can edit content remotely, but lesson IDs, order, and count are fixed to match the HTML routes.

## Data and Flow

The main data shapes are:

- **Course:** `id`, `title`, `description`, ordered `lessons` (`intro-to-ai` is the seed ID).
- **Lesson:** `id`, `title`, `summary`, and `sections` with headings, paragraphs, and optional points. IDs map to `lesson-1.html` through `lesson-3.html`.
- **Progress:** `user_id`, `course_id`, `lesson_id`, `completed_at`; it stores completion, not content.

Supabase maps these to `course_content` (`id`, full course JSONB, `updated_at`), `lesson_progress` (one row per user/course/lesson, composite primary key), and `course_feedback` (one feedback value per user/course). Feedback is required after all lessons are complete.

`content + saved progress -> page logic -> screens`. The overview derives statuses, percentage, and next lesson from fetched IDs; lesson pages render course sections and completion state. On **Complete**, the UI shows a saving state, inserts the row, then updates its in-memory ID `Set` and button/status in place (no full-page re-render). Failed saves do not mark the lesson complete.

## Accounts and Access

Supabase Auth supplies each learner's UUID. RLS is enabled on all three tables and anonymous access is revoked. Authenticated users can read course content; only admins can insert or update it. Learners can read/insert their own progress and read/insert/update their feedback. Admin policies allow reading all progress and deleting course progress and feedback.

The trusted `app_metadata.role = 'admin'` claim gates the admin UI. `admin.js` signs out other users, but RLS is the security boundary; role assignment is done in trusted Supabase tooling.

## Design Questions

- **Why is content fixed in version 1?** It is only partly fixed here: the bundled seed is a fallback and the admin editor can save remote content. IDs/order stay fixed for the static routes and database constraints.
- **How is content separated from learner progress?** Content is shared by course ID; progress and feedback are separate user-owned rows. Editing content does not clear progress.
- **What happens when stored progress is cleared?** Admin reset deletes course progress and feedback, not content; learners see zero progress on their next load. Clearing Local Storage only signs out and leaves server rows intact.
- **How does the UI avoid stale progress after Complete?** It waits for the insert before updating its in-memory set and control. The primary key prevents duplicate rows; failures show an error without marking completion.

## Why Supabase

Accounts/server storage expand the original version-one scope to provide learner-owned progress and required feedback across devices. Supabase Auth supplies identity; PostgreSQL/RLS persist and isolate records. Old browser-only progress is not imported because it has no verified owner.

Content read failures use the bundled course. If progress reads fail after authentication, the overview shows an unavailable message with zero progress; lesson content remains readable but completion cannot be saved. Feedback/admin reads report errors and use a fallback where implemented. Authentication still requires Supabase; failed user verification redirects protected pages to sign-in.

## If this grew

The next design step would be to version and validate course content separately from its static routes, then add automated tests for the UI flows and RLS policies. Those capabilities are not part of the current implementation.