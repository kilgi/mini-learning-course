const catalog = document.querySelector("#catalog-view");
const courseList = document.querySelector("#course-list");
const catalogStatus = document.querySelector("#catalog-status");
const lessonView = document.querySelector("#lesson-view");
const query = new URLSearchParams(window.location.search);
let hasRenderedCatalog = false;

function lessonUrl(courseId, lessonId) {
	const params = new URLSearchParams({ course: courseId, lesson: lessonId });
	return `student.html?${params}`;
}

function appendText(parent, tag, text, className) {
	const element = document.createElement(tag);
	element.textContent = text;
	if (className) {
		element.className = className;
	}
	parent.append(element);
	return element;
}

function renderCourse(course, index, progress, animateEntrance) {
	const card = document.createElement("article");
	const lessonIds = new Set((course.lessons || []).map((lesson) => lesson.id));
	const completed = new Set(progress.filter((row) => row.course_id === course.id && lessonIds.has(row.lesson_id)).map((row) => row.lesson_id));
	const total = lessonIds.size;
	const percent = total ? Math.round(completed.size / total * 100) : 0;

	card.className = animateEntrance ? "course-card entrance-once" : "course-card";
	appendText(card, "p", `COURSE ${String(index + 1).padStart(2, "0")}`, "course-index");
	appendText(card, "h2", course.title || "Untitled course");
	appendText(card, "p", course.description || "", "course-description");
	const progressLabel = appendText(card, "p", `Progress: ${completed.size} of ${total} (${percent}%)`, "course-progress-label");
	const progressBar = document.createElement("progress");
	progressBar.className = "course-progress-track";
	progressBar.max = Math.max(total, 1);
	progressBar.value = completed.size;
	progressBar.setAttribute("aria-label", `${course.title} progress`);
	card.append(progressBar);

	const list = document.createElement("ol");
	list.className = "course-lesson-list";
	(course.lessons || []).forEach((lesson, lessonIndex) => {
		const row = document.createElement("li");
		row.className = animateEntrance ? "course-lesson-row entrance-once" : "course-lesson-row";
		const link = document.createElement("a");
		link.href = lessonUrl(course.id, lesson.id);
		link.textContent = `Lesson ${lessonIndex + 1}: ${lesson.title}`;
		const state = appendText(row, "span", completed.has(lesson.id) ? "Completed" : "Not started", "course-lesson-status");
		if (completed.has(lesson.id)) {
			state.classList.add("is-complete");
		}
		row.prepend(link);
		list.append(row);
	});
	card.append(list);
	const footer = document.createElement("div");
	footer.className = "course-card-footer";
	appendText(footer, "span", `${total} ${total === 1 ? "lesson" : "lessons"}`, "course-lesson-count");
	const next = (course.lessons || []).find((lesson) => !completed.has(lesson.id));
	if (next) {
		const continueLink = document.createElement("a");
		continueLink.className = "course-link";
		continueLink.href = lessonUrl(course.id, next.id);
		continueLink.textContent = "Continue learning";
		footer.append(continueLink);
	}
	card.append(footer);
	return card;
}

function renderLessonContent(lesson) {
	const content = document.querySelector("#lesson-content");
	content.replaceChildren();
	(lesson.sections || []).forEach((section) => {
		const sectionElement = document.createElement("section");
		appendText(sectionElement, "h2", section.heading || "");
		(section.paragraphs || []).forEach((text) => appendText(sectionElement, "p", text));
		if (section.points?.length) {
			const list = document.createElement("ul");
			section.points.forEach((text) => appendText(list, "li", text));
			sectionElement.append(list);
		}
		content.append(sectionElement);
	});
}

async function renderMaterials(lesson) {
	const materials = document.querySelector("#lesson-materials");
	const list = document.querySelector("#material-list");
	list.replaceChildren();
	for (const material of lesson.resources || []) {
		let href = material.url;
		if (material.path) {
			const { data, error } = await supabaseClient.storage.from("course-materials").createSignedUrl(material.path, 3600);
			if (error) {
				continue;
			}
			href = data.signedUrl;
		}
		try {
			const resourceUrl = new URL(href);
			if (!['https:', 'http:'].includes(resourceUrl.protocol)) {
				continue;
			}
			const row = document.createElement("li");
			const link = document.createElement("a");
			link.href = resourceUrl.href;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			link.textContent = material.title || material.name || "Open material";
			row.append(link);
			list.append(row);
		} catch {
			continue;
		}
	}
	materials.hidden = list.childElementCount === 0;
}

function setLessonLink(link, course, lesson, label) {
	link.href = lesson ? lessonUrl(course.id, lesson.id) : "student.html";
	link.textContent = label;
	link.hidden = !lesson;
}

async function renderSelectedLesson(courses, progress, user) {
	const course = courses.find((item) => item.id === query.get("course"));
	const lessonIndex = course?.lessons?.findIndex((item) => item.id === query.get("lesson")) ?? -1;
	const lesson = lessonIndex >= 0 ? course.lessons[lessonIndex] : null;
	if (!course || !lesson) {
		catalogStatus.textContent = "That course or lesson could not be found.";
		catalogStatus.hidden = false;
		return;
	}

	catalog.hidden = true;
	lessonView.hidden = false;
	document.title = `${lesson.title} | ${course.title}`;
	document.querySelector("#lesson-number").textContent = `${course.title.toUpperCase()} / LESSON ${String(lessonIndex + 1).padStart(2, "0")}`;
	document.querySelector("#lesson-title").textContent = lesson.title;
	document.querySelector("#lesson-summary").textContent = lesson.summary || "";
	document.querySelector("#lesson-back").href = "student.html";
	renderLessonContent(lesson);
	await renderMaterials(lesson);

	const completeButton = document.querySelector("#complete-lesson");
	const status = document.querySelector("#lesson-status");
	const completed = new Set(progress.filter((row) => row.course_id === course.id).map((row) => row.lesson_id));
	function refreshCompletion() {
		const done = completed.has(lesson.id);
		completeButton.disabled = done;
		completeButton.setAttribute("aria-pressed", String(done));
		completeButton.textContent = done ? "Lesson completed" : "Mark lesson complete";
	}
	refreshCompletion();
	completeButton.addEventListener("click", async () => {
		completeButton.disabled = true;
		status.textContent = "Saving your progress...";
		status.hidden = false;
		const { error } = await supabaseClient.from("lesson_progress").insert({
			user_id: user.id,
			course_id: course.id,
			lesson_id: lesson.id
		});
		if (error && error.code !== "23505") {
			completeButton.disabled = false;
			status.textContent = "Progress could not be saved. Check your connection and try again.";
			return;
		}
		completed.add(lesson.id);
		refreshCompletion();
		status.textContent = "Your progress is saved.";
	});

	setLessonLink(document.querySelector("#previous-lesson"), course, course.lessons[lessonIndex - 1], course.lessons[lessonIndex - 1] ? `← ${course.lessons[lessonIndex - 1].title}` : "");
	const nextLesson = course.lessons[lessonIndex + 1];
	const nextLink = document.querySelector("#next-lesson");
	if (nextLesson) {
		setLessonLink(nextLink, course, nextLesson, `${nextLesson.title} →`);
	} else {
		nextLink.hidden = false;
		nextLink.href = "student.html";
		nextLink.textContent = "Back to courses →";
	}
}

async function initializeStudentPage() {
	const user = await getCurrentUser();
	if (!user) {
		window.location.replace("login.html");
		return;
	}
	showAccount(user);
	document.body.classList.remove("auth-pending");
	if (!supabaseClient) {
		catalogStatus.textContent = "Database access is not configured.";
		catalogStatus.hidden = false;
		return;
	}

	const [{ data: rows, error: coursesError }, { data: progressRows, error: progressError }] = await Promise.all([
		supabaseClient.from("course_content").select("id, content").eq("published", true).order("updated_at", { ascending: false }),
		supabaseClient.from("lesson_progress").select("course_id, lesson_id").eq("user_id", user.id)
	]);
	if (coursesError) {
		catalogStatus.textContent = "Courses could not be loaded. Check the Supabase course-content setup and try again.";
		catalogStatus.hidden = false;
		return;
	}
	const courses = (rows || []).map((row) => row.content).filter((course) => course && Array.isArray(course.lessons));
	const progress = progressError ? [] : (progressRows || []);
	if (progressError) {
		catalogStatus.textContent = "Your saved progress could not be loaded; course content is still available.";
		catalogStatus.hidden = false;
	}
	if (!query.has("lesson")) {
		if (courses.length) {
			const animateEntrance = !hasRenderedCatalog;
			courseList.replaceChildren(...courses.map((course, index) => renderCourse(course, index, progress, animateEntrance)));
			hasRenderedCatalog = true;
		} else if (!progressError) {
			catalogStatus.textContent = "No courses are published yet.";
			catalogStatus.hidden = false;
		}
	} else {
		await renderSelectedLesson(courses, progress, user);
	}
}

initializeStudentPage().catch(() => {
	document.body.classList.remove("auth-pending");
	catalogStatus.textContent = "The course library could not be loaded. Refresh and try again.";
	catalogStatus.hidden = false;
});