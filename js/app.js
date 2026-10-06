const courseListElement = document.querySelector("#course-list");
const catalogStatus = document.querySelector("#catalog-status");

function lessonPath(lesson) {
	return `${lesson.id}.html`;
}

function renderCourseCard(course, index, userId, completedLessonIds, feedback = "") {
	const card = document.createElement("article");
	const number = document.createElement("p");
	const title = document.createElement("h2");
	const description = document.createElement("p");
	const progress = document.createElement("div");
	const progressLabel = document.createElement("p");
	const progressBar = document.createElement("div");
	const progressFill = document.createElement("span");
	const completionStatus = document.createElement("p");
	const feedbackForm = document.createElement("form");
	const feedbackLabel = document.createElement("label");
	const feedbackInput = document.createElement("textarea");
	const feedbackSubmit = document.createElement("button");
	const feedbackStatus = document.createElement("p");
	const lessonsDisclosure = document.createElement("details");
	const lessonsSummary = document.createElement("summary");
	const lessonList = document.createElement("ol");
	const footer = document.createElement("div");
	const count = document.createElement("span");
	const link = document.createElement("a");
	const courseLessonIds = new Set(course.lessons.map((lesson) => lesson.id));
	const completedLessons = new Set(completedLessonIds.filter((lessonId) => courseLessonIds.has(lessonId)));
	const totalLessons = courseLessonIds.size;
	const completedCount = completedLessons.size;
	const progressPercent = totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);
	const allLessonsComplete = totalLessons > 0 && completedCount === totalLessons;
	const isComplete = allLessonsComplete && Boolean(feedback.trim());

	card.className = "course-card";
	card.style.setProperty("--order", String(index));
	number.className = "course-index";
	number.textContent = `COURSE ${String(index + 1).padStart(2, "0")}`;
	title.textContent = course.title;
	description.className = "course-description";
	description.textContent = course.description;
	progress.className = "course-progress";
	progressLabel.className = "course-progress-label";
	progressLabel.textContent = `Progress: ${completedCount} of ${totalLessons} (${progressPercent}%)`;
	progressBar.className = "course-progress-track";
	progressBar.setAttribute("role", "progressbar");
	progressBar.setAttribute("aria-label", `${course.title} progress`);
	progressBar.setAttribute("aria-valuemin", "0");
	progressBar.setAttribute("aria-valuemax", String(totalLessons));
	progressBar.setAttribute("aria-valuenow", String(completedCount));
	progressFill.className = "course-progress-fill";
	progressFill.style.width = `${progressPercent}%`;
	progressBar.append(progressFill);
	completionStatus.className = "course-completion-status";
	completionStatus.textContent = isComplete
		? "Course completed"
		: "All lessons complete. Submit feedback to finish this course.";
	completionStatus.hidden = !allLessonsComplete;
	progress.append(progressLabel, progressBar, completionStatus);
	feedbackForm.className = "course-feedback";
	feedbackForm.hidden = !allLessonsComplete || Boolean(feedback.trim());
	feedbackLabel.className = "course-feedback-label";
	feedbackLabel.textContent = "Required course feedback";
	feedbackInput.className = "course-feedback-input";
	feedbackInput.name = "feedback";
	feedbackInput.inputMode = "text";
	feedbackInput.rows = 3;
	feedbackInput.maxLength = 2000;
	feedbackInput.required = true;
	feedbackInput.value = feedback;
	feedbackInput.placeholder = "What worked well, and what could be improved?";
	feedbackLabel.append(feedbackInput);
	feedbackSubmit.className = "course-feedback-submit";
	feedbackSubmit.type = "submit";
	feedbackSubmit.textContent = "Submit feedback";
	feedbackStatus.className = "course-feedback-status";
	feedbackStatus.setAttribute("role", "status");
	feedbackForm.append(feedbackLabel, feedbackSubmit, feedbackStatus);
	feedbackForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		feedbackStatus.textContent = "";
		if (!feedbackInput.value.trim()) {
			feedbackStatus.textContent = "Feedback cannot be blank.";
			feedbackInput.focus();
			return;
		}
		feedbackSubmit.disabled = true;
		feedbackSubmit.textContent = "Saving...";
		try {
			await saveCourseFeedback(userId, course.id, feedbackInput.value);
			completionStatus.textContent = "Course completed";
			feedbackLabel.hidden = true;
			feedbackSubmit.hidden = true;
			feedbackStatus.textContent = "Feedback saved. Course completed.";
		} catch {
			feedbackStatus.textContent = "Feedback could not be saved. Check your connection and try again.";
			feedbackSubmit.textContent = "Submit feedback";
		} finally {
			feedbackSubmit.disabled = false;
		}
	});
	lessonsDisclosure.className = "course-lessons";
	lessonsSummary.append(title);
	lessonList.className = "course-lesson-list";
	course.lessons.forEach((lesson, lessonIndex) => {
		const item = document.createElement("li");
		const lessonLink = document.createElement("a");
		const lessonStatus = document.createElement("span");
		const isLessonComplete = completedLessons.has(lesson.id);

		item.className = "course-lesson-row";
		lessonLink.href = lessonPath(lesson);
		lessonLink.textContent = `Lesson ${lessonIndex + 1}: ${lesson.title}`;
		lessonStatus.className = isLessonComplete ? "course-lesson-status is-complete" : "course-lesson-status";
		lessonStatus.textContent = isLessonComplete ? "Completed" : "Not started";
		item.append(lessonLink, lessonStatus);
		lessonList.append(item);
	});
	lessonsDisclosure.append(lessonsSummary, lessonList);
	footer.className = "course-card-footer";
	count.className = "course-lesson-count";
	count.textContent = `${course.lessons.length} lessons`;
	link.className = "course-link";
	const nextLesson = course.lessons.find((lesson) => !completedLessons.has(lesson.id));
	link.href = nextLesson ? lessonPath(nextLesson) : "#";
	link.textContent = "Continue Learning";
	link.hidden = allLessonsComplete;

	footer.append(count, link);
	card.append(number, lessonsDisclosure, description, progress, feedbackForm, footer);
	return card;
}

async function initializeCatalog() {
	const user = await getCurrentUser();
	if (!user) {
		window.location.replace("login.html");
		return;
	}

	document.body.classList.remove("auth-pending");
	showAccount(user);
	const course = await getCourseContent(COURSE);

	courseListElement.append(renderCourseCard(course, 0, user.id, []));

	try {
		const completions = await getCompletedLessons(user.id, course.id);
		let feedback = "";
		try {
			feedback = await getCourseFeedback(user.id, course.id);
		} catch {
			catalogStatus.textContent = "Feedback storage is unavailable. Run the course feedback SQL in docs/supabase-setup.md before completing the course.";
			catalogStatus.hidden = false;
		}
		courseListElement.replaceChildren(renderCourseCard(course, 0, user.id, completions, feedback));
	} catch {
		catalogStatus.textContent = "Saved progress is unavailable. Showing 0% until it can be synced.";
		catalogStatus.hidden = false;
	}
}

initializeCatalog();
