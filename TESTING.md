# Manual Test Log

- **Live link:** https://kilgi.github.io/mini-learning-course
- **Test date:**
- **Browser:**
- **Device:**

Use separate student accounts, at least two accounts with trusted `app_metadata.role = 'teacher'`, and one `app_metadata.role = 'admin'` account for role tests. Configure Supabase using [docs/supabase-setup.md](docs/supabase-setup.md), then run [docs/ownership-migration.sql](docs/ownership-migration.sql) after the setup tables exist. Assign legacy courses to teachers and rerun the ownership migration as described there. Do not use production accounts for destructive checks.

| Area | Test | Steps | Expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| Student | Wrong password shows an error | Sign in with a valid account email and an incorrect password. | A clear incorrect-email-or-password message appears and sign-in does not succeed. |  |  |
| Student | Progress cannot be double counted | Complete one lesson, reload and inspect progress; then attempt to insert the same `(user_id, course_id, lesson_id)` completion again using the authenticated test client. | The lesson contributes at most one completion. The composite primary key rejects a duplicate and the UI continues to show it as complete. |  |  |
| Student | Course and lesson content load | Sign in and open a course, a lesson, and its resources. | Content comes from `course_content`; external links and signed resource URLs open as expected. |  |  |
| Teacher | Teacher can manage an owned course | Sign in using an account with trusted `app_metadata.role = 'teacher'`; create, save, reopen, and edit a course. | The teacher can use the studio and saved content persists. |  |  |
| Teacher | Teacher cannot see another teacher's courses | Create a course as teacher A, then sign in as teacher B and inspect the course picker or open teacher A's course URL. | Teacher B cannot load or update teacher A's course. |  |  |
| Teacher | Same-title courses receive distinct IDs | Have teacher A and teacher B create courses with the same title. | Each new course receives a distinct ID and both courses can be saved. |  |  |
| Teacher | Publish and unpublish a course | Save a new course, publish it from its overview, then unpublish it. | The control reflects each status, and only the published state is returned to students. |  |  |
| Teacher | Saving preserves publication state | Publish a course, edit its content, and save it. | The course remains published after saving; only the Publish/Unpublish control changes its publication state. |  |  |
| Teacher | Owner can delete their own course, including its files, and student progress for it | As teacher A, create and publish a course with an uploaded file; create student progress and feedback for that course; delete it from the teacher studio. | The course and uploaded files are removed, and the database function deletes the course's progress and feedback. |  |  |
| Security | Teacher B cannot delete teacher A's course (button hidden, and a direct call to the delete function is refused) | Sign in as teacher B, inspect teacher A's course URL and invoke `delete_owned_course` directly with teacher A's course ID. | Teacher B has no delete control for the course, and the function refuses the unauthorized call without deleting data. |  |  |
| Security | Student cannot reach teacher pages | Sign in as a student, open `teacher.html` directly, and try the teacher login URL. | The editor remains inaccessible and the page reports that the account is not authorized. |  |  |
| Security | Teacher A cannot edit teacher B's course | Create a course as teacher A, then sign in as teacher B and try to load and update that course. | Teacher B is denied access to teacher A's course. |  |  |
| Security | Drafts are hidden from students | Save a course from teacher mode and inspect the student course query before publication. | The unpublished course is not returned to students; publishing makes it visible and unpublishing hides it again. |  |  |
| Security | Teacher progress access is course-scoped | Record progress for courses owned by teacher A and teacher B, then read progress as teacher A. | Teacher A can read progress only for courses teacher A owns, in addition to their own learner progress. |  |  |
| Security | Storage access follows ownership and visibility | Upload as teacher A, then inspect/download as teacher B and as a student before and after publication. | Before publication, only teacher A and admins can read the referenced file. After publication, authenticated users who can see the course can read it; only teacher A or an admin can delete it. |  |  |
| Security | Progress belongs to its student | Create progress as student A, then query progress as student B using the authenticated client. | Student B cannot read or change student A's progress rows. |  |  |