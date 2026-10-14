# Manual Test Log

- **Live link:** https://kilgi.github.io/mini-learning-course
- **Test date:**
- **Browser:**
- **Device:**

Use separate student accounts and at least two accounts with trusted `app_metadata.role = 'admin'` for role tests. Configure Supabase using [docs/supabase-setup.md](docs/supabase-setup.md), then run [docs/security-fix.sql](docs/security-fix.sql) after the setup tables exist. Do not use production accounts for destructive checks.

**Known coverage limits:** The current schema has no course-owner field, so every trusted admin-role account can edit every course. It also has no draft/published status; saved course rows are immediately readable by students. The ownership and draft tests below are included to make these limitations visible, not to imply the current system passes them.

| Area | Test | Steps | Expected result | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| Student | Wrong password shows an error | Sign in with a valid account email and an incorrect password. | A clear incorrect-email-or-password message appears and sign-in does not succeed. |  |  |
| Student | Progress cannot be double counted | Complete one lesson, reload and inspect progress; then attempt to insert the same `(user_id, course_id, lesson_id)` completion again using the authenticated test client. | The lesson contributes at most one completion. The composite primary key rejects a duplicate and the UI continues to show it as complete. |  |  |
| Student | Course and lesson content load | Sign in and open a course, a lesson, and its resources. | Content comes from `course_content`; external links and signed resource URLs open as expected. |  |  |
| Teacher | Authorized teacher can manage a course | Sign in using an account with trusted `app_metadata.role = 'admin'`; create, save, reopen, and edit a course. | The authorized account can use the teacher studio and saved content persists. |  |  |
| Security | Student cannot reach teacher pages | Sign in as a student, open `teacher.html` directly, and try the teacher login URL. | The editor remains inaccessible and the page reports that the account is not authorized. |  |  |
| Security | Teacher A cannot edit teacher B's course | Create a course as teacher A, then sign in as teacher B and try to load and update that course. | Teacher B should be denied access to teacher A's course. **Current implementation does not enforce this:** course rows have no owner and the admin-role policy permits updates to any course. |  |  |
| Security | Drafts are hidden from students | Save a course from teacher mode and inspect the student course query before publication. | An unpublished draft should not be returned to students. **Current implementation has no draft/published state:** saved rows are readable by authenticated students. |  |  |
| Security | Progress belongs to its student | Create progress as student A, then query progress as student B using the authenticated client. | Student B cannot read or change student A's progress rows. |  |  |