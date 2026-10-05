const lessonId = document.querySelector("[data-lesson-id]").dataset.lessonId;
const lessonStatus = document.querySelector("#lesson-status");

async function initializeLesson() {
	const user = await getCurrentUser();
	if (!user) {
		window.location.replace("login.html");
		return;
	}

	document.body.classList.remove("auth-pending");
	showAccount(user);
	const course = await getCourseContent(COURSE);
	const lessonIndex = course.lessons.findIndex((item) => item.id === lessonId);
	const lesson = course.lessons[lessonIndex];

	if (!lesson) {
		document.querySelector("#lesson-title").textContent = "Lesson not found";
		document.querySelector("#lesson-summary").textContent = "This lesson is not available in the current course catalog.";
		return;
	}

	const titleElement = document.querySelector("#lesson-title");
	const summaryElement = document.querySelector("#lesson-summary");
	const numberElement = document.querySelector("#lesson-number");
	const contentElement = document.querySelector("#lesson-content");
	const previousLink = document.querySelector("#previous-lesson");
	const nextLink = document.querySelector("#next-lesson");
	const completeButton = document.querySelector("#complete-lesson");
	const completedLessonIds = new Set();
	let hasCourseFeedback = false;
	completeButton.disabled = true;

	document.title = `${lesson.title} | ${course.title}`;
	titleElement.textContent = lesson.title;
	summaryElement.textContent = lesson.summary;
	numberElement.textContent = `LESSON ${String(lessonIndex + 1).padStart(2, "0")} / ${String(course.lessons.length).padStart(2, "0")}`;

	function updateCompletionButton() {
		const isComplete = completedLessonIds.has(lesson.id);
		completeButton.disabled = isComplete;
		completeButton.setAttribute("aria-pressed", String(isComplete));
		completeButton.textContent = isComplete ? "Lesson completed" : "Mark lesson complete";
		lessonStatus.textContent = isComplete ? "You can continue reading this lesson." : "";
		lessonStatus.hidden = !isComplete;
	}

	lesson.sections.forEach((section) => {
		const sectionElement = document.createElement("section");
		const heading = document.createElement("h2");
		heading.textContent = section.heading;
		sectionElement.append(heading);

		section.paragraphs.forEach((text) => {
			const paragraph = document.createElement("p");
			paragraph.textContent = text;
			sectionElement.append(paragraph);
		});

		if (section.points) {
			const list = document.createElement("ul");
			section.points.forEach((text) => {
				const point = document.createElement("li");
				point.textContent = text;
				list.append(point);
			});
			sectionElement.append(list);
		}

		contentElement.append(sectionElement);
	});

	try {
		const savedLessonIds = await getCompletedLessons(user.id, course.id);
		savedLessonIds.forEach((savedLessonId) => completedLessonIds.add(savedLessonId));
		updateCompletionButton();
		try {
			const feedback = await getCourseFeedback(user.id, course.id);
			hasCourseFeedback = Boolean(feedback.trim());
		} catch {
			hasCourseFeedback = false;
		}
		if (completedLessonIds.size === course.lessons.length) {
			lessonStatus.textContent = hasCourseFeedback
				? "Course completed. You can revisit any lesson."
				: "All lessons complete. Submit the required feedback from the course library to finish.";
			lessonStatus.hidden = false;
		}
	} catch {
		lessonStatus.textContent = "Saved progress is unavailable. You can still read this lesson.";
		lessonStatus.hidden = false;
	}

	completeButton.addEventListener("click", async () => {
		completeButton.disabled = true;
		lessonStatus.hidden = false;
		lessonStatus.textContent = "Saving your progress...";
		try {
			await completeLesson(user.id, course.id, lesson.id);
			completedLessonIds.add(lesson.id);
			updateCompletionButton();
			if (completedLessonIds.size === course.lessons.length) {
				lessonStatus.textContent = hasCourseFeedback
					? "Course completed. You can revisit any lesson."
					: "All lessons complete. Submit the required feedback from the course library to finish.";
			}
		} catch {
			completeButton.disabled = false;
			lessonStatus.textContent = "Progress could not be saved. Check your connection and try again.";
		}
	});

	if (lessonIndex > 0) {
		previousLink.href = `${course.lessons[lessonIndex - 1].id}.html`;
		previousLink.textContent = `\u2190 ${course.lessons[lessonIndex - 1].title}`;
	} else {
		previousLink.hidden = true;
	}

	if (lessonIndex < course.lessons.length - 1) {
		nextLink.href = `${course.lessons[lessonIndex + 1].id}.html`;
		nextLink.textContent = `${course.lessons[lessonIndex + 1].title} \u2192`;
	} else {
		nextLink.href = "index.html";
		nextLink.textContent = "Back to courses \u2192";
	}
}

initializeLesson().catch(() => {
	document.body.classList.remove("auth-pending");
	lessonStatus.textContent = "This lesson could not be loaded. Please refresh and try again.";
	lessonStatus.hidden = false;
});