const courseListElement = document.querySelector("#course-list");
const catalogStatus = document.querySelector("#catalog-status");

function lessonPath(lesson) {
	return `${lesson.id}.html`;
}

function renderCourseCard(course, index, completedLessonIds) {
	const card = document.createElement("article");
	const number = document.createElement("p");
	const title = document.createElement("h2");
	const description = document.createElement("p");
	const progress = document.createElement("div");
	const progressLabel = document.createElement("p");
	const progressBar = document.createElement("div");
	const progressFill = document.createElement("span");
	const completionStatus = document.createElement("p");
	const lessonsDisclosure = document.createElement("details");
	const lessonsSummary = document.createElement("summary");
	const lessonList = document.createElement("ol");
	const footer = document.createElement("div");
	const count = document.createElement("span");
	const link = document.createElement("a");
	const completedLessons = new Set(completedLessonIds);
	const totalLessons = course.lessons.length;
	const completedCount = course.lessons.filter((lesson) => completedLessons.has(lesson.id)).length;
	const progressPercent = totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);
	const isComplete = totalLessons > 0 && completedCount === totalLessons;

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
	completionStatus.textContent = "Course completed";
	completionStatus.hidden = !isComplete;
	progress.append(progressLabel, progressBar, completionStatus);
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
	const nextLesson = course.lessons.find((lesson) => !completedLessons.has(lesson.id)) || course.lessons[0];
	link.href = nextLesson ? lessonPath(nextLesson) : "#";
	link.textContent = "Continue Learning";

	footer.append(count, link);
	card.append(number, lessonsDisclosure, description, progress, footer);
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

	COURSES.forEach((course, index) => {
		courseListElement.append(renderCourseCard(course, index, []));
	});

	try {
		const completions = await Promise.all(COURSES.map((course) => getCompletedLessons(user.id, course.id)));
		courseListElement.replaceChildren(...COURSES.map((course, index) => renderCourseCard(course, index, completions[index])));
	} catch {
		catalogStatus.textContent = "Saved progress is unavailable. Showing 0% until it can be synced.";
		catalogStatus.hidden = false;
	}
}

initializeCatalog();
