# Manual Test Log

- **Live link:**
- **Test date:**
- **Browser:**
- **Device:**

Use a dedicated test learner and teacher. The teacher account must have trusted `app_metadata.role = 'admin'`. Run the current SQL in `docs/supabase-setup.md` and `docs/security-fix.sql` before testing database and file workflows.

| Check | Steps | Expected result | Result (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- |
| Public entry | Open the site root while signed out. | `index.html` introduces the library and links to sign-in, courses, and the teacher studio; it does not display the learner catalog. |  |  |
| Teacher authorization | Open `teacher.html` as a learner without the admin app-metadata role, then as the trusted teacher. | Learner receives an access-denied message and cannot open the editor. Teacher can access the studio. |  |  |
| Create and preview courses | As teacher, create two courses with different lesson counts. Use Next to move through lessons, Back to revisit one and verify its content remains, then save on the final lesson. | Each step shows the correct lesson number; after saving, the teacher is redirected to an overview showing the course name, description, lesson text, and resources. Both courses appear in the course selector and student library. |  |  |
| Add lesson materials | Add lesson text, an https link, a PDF, and a Word document; save the course. | The lesson and resource metadata persist after refresh. Files upload to the private Storage bucket. |  |  |
| Student lesson access | Sign in as a learner, open each course and lesson, and follow previous/next navigation. | All database-backed titles and text render in the dynamic student page. Resource links open safely and uploaded files use signed URLs. |  |  |
| Student progress | Mark lessons complete, refresh, and continue through another course. | Completion persists per learner, course, and lesson; counts and next lesson are correct after refresh. |  |  |
| Failed database access | Block Supabase requests and reload the student library. | A clear status appears; the page does not crash or show bundled static course content as if it came from the database. |  |  |
| Responsive at 375px | Inspect the public home, student catalog, dynamic lesson, and teacher editor at 375 CSS pixels. | No horizontal overflow, clipped labels, or overlapping controls; file inputs and form actions remain usable. |  |  |
| Keyboard and accessibility | Navigate all pages using Tab, Shift+Tab, Enter, and Space; run Lighthouse Accessibility. | Interactive controls have visible focus and accessible names; each page has a clear H1; completion states use text, not color alone. |  |  |
| Sign-in and sign-out | Try an incorrect password, then sign in and sign out normally. | Clear authentication errors appear; successful sign-in opens the student library and sign-out returns to the public home. |  |  |