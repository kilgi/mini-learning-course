const teacherWorkspace = document.querySelector("#teacher-workspace");
const teacherAccess = document.querySelector("#teacher-access");
const teacherStatus = document.querySelector("#teacher-status");
const teacherPageTitle = document.querySelector(".admin-page-title");
const coursePicker = document.querySelector("#course-picker");
const courseForm = document.querySelector("#course-form");
const lessonCountInput = document.querySelector("#lesson-count");
const lessonContainer = document.querySelector("#teacher-lessons");
const courseDetailsStep = document.querySelector("#course-details-step");
const lessonEditorStep = document.querySelector("#lesson-editor-step");
const teacherEditorView = document.querySelector("#teacher-editor-view");
const teacherOverview = document.querySelector("#teacher-overview");
let savedCourses = [];
let activeCourse = null;
let originalCourse = null;
let currentLessonIndex = 0;
let previewCourse = null;

function setTeacherStatus(message, isError = false) {
	teacherStatus.textContent = message;
	teacherStatus.classList.toggle("is-error", isError);
	teacherStatus.hidden = !message;
}

function newId(prefix) {
	return `${prefix}-${crypto.randomUUID()}`;
}

function createLessonDraft() {
	return { id: newId("lesson"), title: "", summary: "", sections: [{ heading: "Lesson", paragraphs: [] }], resources: [] };
}

function synchronizeLessonCount() {
	if (!activeCourse) {
		return false;
	}
	const requestedCount = lessonCountInput.valueAsNumber;
	if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 50) {
		return false;
	}
	if (requestedCount < activeCourse.lessons.length) {
		activeCourse.lessons.splice(requestedCount);
	} else {
		while (activeCourse.lessons.length < requestedCount) {
			activeCourse.lessons.push(createLessonDraft());
		}
	}
	activeCourse.lessons.forEach((lesson) => { lesson.resources ||= []; });
	return true;
}

function refreshPicker(selectedId = "") {
	coursePicker.replaceChildren(new Option("Choose a course", ""));
	savedCourses.forEach((course) => coursePicker.add(new Option(course.title || "Untitled course", course.id)));
	coursePicker.value = selectedId;
}

function renderResourceList(lesson, list) {
	list.replaceChildren();
	lesson.resources.forEach((resource, index) => {
		const row = document.createElement("li");
		const label = document.createElement("span");
		label.textContent = `${resource.title || resource.name || "Resource"}${resource.path ? " (uploaded file)" : " (link)"}`;
		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "teacher-remove-button";
		remove.textContent = "Remove";
		remove.setAttribute("aria-label", `Remove ${resource.title || resource.name || "resource"}`);
		remove.addEventListener("click", () => {
			lesson.resources.splice(index, 1);
			renderResourceList(lesson, list);
		});
		row.append(label, remove);
		list.append(row);
	});
}

function renderLessons(index) {
	lessonContainer.replaceChildren();
	const lesson = activeCourse.lessons[index];
	if (!lesson) {
		return;
	}
	const panel = document.createElement("fieldset");
	panel.className = "teacher-lesson-editor";
	const legend = document.createElement("legend");
	legend.textContent = `Lesson ${index + 1}`;
	panel.append(legend);

	const titleLabel = document.createElement("label");
	titleLabel.className = "teacher-field";
	titleLabel.textContent = "Lesson title";
	const titleInput = document.createElement("input");
	titleInput.value = lesson.title || "";
	titleInput.maxLength = 120;
	titleInput.required = true;
	titleInput.addEventListener("input", () => {
		lesson.title = titleInput.value;
		if (lesson.sections[0]) {
			lesson.sections[0].heading = lesson.title || "Lesson";
		}
	});
	titleLabel.append(titleInput);

	const summaryLabel = document.createElement("label");
	summaryLabel.className = "teacher-field";
	summaryLabel.textContent = "Short summary";
	const summaryInput = document.createElement("input");
	summaryInput.value = lesson.summary || "";
	summaryInput.maxLength = 300;
	summaryInput.required = true;
	summaryInput.addEventListener("input", () => { lesson.summary = summaryInput.value; });
	summaryLabel.append(summaryInput);

	const bodyLabel = document.createElement("label");
	bodyLabel.className = "teacher-field";
	bodyLabel.textContent = "Lesson text (separate paragraphs with a blank line)";
	const bodyInput = document.createElement("textarea");
	bodyInput.rows = 7;
	bodyInput.value = (lesson.sections || []).flatMap((section) => section.paragraphs || []).join("\n\n");
	bodyInput.required = true;
	bodyInput.addEventListener("input", () => {
		lesson.sections = [{ heading: lesson.title || "Lesson", paragraphs: bodyInput.value.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean) }];
	});
	bodyLabel.append(bodyInput);

	const resources = document.createElement("ul");
	resources.className = "teacher-resource-list";
	renderResourceList(lesson, resources);
	const resourceForm = document.createElement("div");
	resourceForm.className = "teacher-resource-form";
	const resourceTitle = document.createElement("input");
	resourceTitle.placeholder = "Resource name";
	resourceTitle.setAttribute("aria-label", `Resource name for lesson ${index + 1}`);
	const resourceUrl = document.createElement("input");
	resourceUrl.type = "url";
	resourceUrl.placeholder = "https://...";
	resourceUrl.setAttribute("aria-label", `Resource URL for lesson ${index + 1}`);
	const addUrl = document.createElement("button");
	addUrl.type = "button";
	addUrl.className = "teacher-secondary-button";
	addUrl.textContent = "Add link";
	addUrl.addEventListener("click", () => {
		try {
			const parsed = new URL(resourceUrl.value);
			if (!['https:', 'http:'].includes(parsed.protocol)) {
				throw new Error();
			}
			lesson.resources.push({ title: resourceTitle.value.trim() || parsed.hostname, url: parsed.href });
			resourceTitle.value = "";
			resourceUrl.value = "";
			renderResourceList(lesson, resources);
		} catch {
			setTeacherStatus("Enter a valid http or https resource URL.", true);
		}
	});
	const fileInput = document.createElement("input");
	fileInput.type = "file";
	fileInput.accept = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
	fileInput.setAttribute("aria-label", `Upload a PDF or document for lesson ${index + 1}`);
	fileInput.addEventListener("change", async () => {
		const file = fileInput.files?.[0];
		if (!file) {
			return;
		}
		const validExtension = /\.(pdf|doc|docx)$/i.test(file.name);
		if (!validExtension || file.size > 20 * 1024 * 1024) {
			setTeacherStatus("Choose a PDF or Word document up to 20 MB.", true);
			fileInput.value = "";
			return;
		}
		fileInput.disabled = true;
		setTeacherStatus("Uploading course material...");
		try {
			const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
			const path = `${activeCourse.id}/${lesson.id}/${crypto.randomUUID()}-${safeName}`;
			const { error } = await supabaseClient.storage.from("course-materials").upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
			if (error) {
				throw error;
			}
			lesson.resources.push({ title: resourceTitle.value.trim() || file.name, name: file.name, path });
			resourceTitle.value = "";
			renderResourceList(lesson, resources);
			setTeacherStatus("Material uploaded. Save the course to publish it.");
		} catch (error) {
			setTeacherStatus(error.message || "The file could not be uploaded.", true);
		} finally {
			fileInput.disabled = false;
			fileInput.value = "";
		}
	});
	resourceForm.append(resourceTitle, resourceUrl, addUrl, fileInput);

	panel.append(titleLabel, summaryLabel, bodyLabel);
	const resourceHeading = document.createElement("h3");
	resourceHeading.className = "teacher-resource-heading";
	resourceHeading.textContent = "Course materials and links";
	panel.append(resourceHeading);
	panel.append(resources, resourceForm);
	lessonContainer.append(panel);
	document.querySelector("#lesson-step-count").textContent = `LESSON ${index + 1} OF ${activeCourse.lessons.length}`;
	document.querySelector("#lesson-step-title").textContent = lesson.title || `Lesson ${index + 1}`;
	document.querySelector("#lesson-next").hidden = index === activeCourse.lessons.length - 1;
	document.querySelector("#save-course").hidden = index !== activeCourse.lessons.length - 1;
}

function showCourseDetails() {
	courseDetailsStep.hidden = false;
	lessonEditorStep.hidden = true;
}

function showLesson(index) {
	currentLessonIndex = index;
	courseDetailsStep.hidden = true;
	lessonEditorStep.hidden = false;
	renderLessons(currentLessonIndex);
}

function validateCurrentLesson() {
	const requiredFields = lessonContainer.querySelectorAll("input[required], textarea[required]");
	for (const field of requiredFields) {
		if (!field.reportValidity()) {
			return false;
		}
	}
	const lesson = activeCourse.lessons[currentLessonIndex];
	if (!lesson.title.trim() || !lesson.summary.trim() || !lesson.sections?.some((section) => section.paragraphs?.some((text) => text.trim()))) {
		setTeacherStatus("Add a title, summary, and lesson text before continuing.", true);
		return false;
	}
	return true;
}

function editCourse(course) {
	teacherPageTitle.textContent = "Build a course.";
	activeCourse = JSON.parse(JSON.stringify(course));
	originalCourse = JSON.parse(JSON.stringify(course));
	activeCourse.lessons.forEach((lesson) => { lesson.resources ||= []; });
	document.querySelector("#course-title").value = activeCourse.title || "";
	document.querySelector("#course-description").value = activeCourse.description || "";
	lessonCountInput.value = String(activeCourse.lessons.length || 1);
	teacherEditorView.hidden = false;
	teacherOverview.hidden = true;
	courseForm.hidden = false;
	showCourseDetails();
	setTeacherStatus("");
}

function createCourse() {
	teacherPageTitle.textContent = "Build a course.";
	activeCourse = { id: newId("course"), title: "", description: "", lessons: [] };
	originalCourse = null;
	coursePicker.value = "";
	document.querySelector("#course-title").value = "";
	document.querySelector("#course-description").value = "";
	lessonCountInput.value = "1";
	teacherEditorView.hidden = false;
	teacherOverview.hidden = true;
	courseForm.hidden = false;
	lessonContainer.replaceChildren();
	showCourseDetails();
	setTeacherStatus("Enter the course details and lesson count to begin.");
}

async function loadCourses() {
	const { data, error } = await supabaseClient.from("course_content").select("id, content").order("updated_at", { ascending: false });
	if (error) {
		throw error;
	}
	savedCourses = (data || []).map((row) => ({ ...row.content, id: row.id }));
	refreshPicker();
}

coursePicker.addEventListener("change", () => {
	const selected = savedCourses.find((course) => course.id === coursePicker.value);
	if (selected) {
		editCourse(selected);
	} else {
		courseForm.hidden = true;
		activeCourse = null;
	}
});

document.querySelector("#new-course").addEventListener("click", createCourse);
courseForm.addEventListener("submit", (event) => event.preventDefault());

document.querySelector("#course-next").addEventListener("click", () => {
	const courseTitle = document.querySelector("#course-title");
	const courseDescription = document.querySelector("#course-description");
	if (!courseTitle.reportValidity() || !courseDescription.reportValidity() || !lessonCountInput.reportValidity()) {
		return;
	}
	activeCourse.title = courseTitle.value.trim();
	activeCourse.description = courseDescription.value.trim();
	if (!activeCourse.title || !activeCourse.description || !synchronizeLessonCount()) {
		setTeacherStatus("Add a course name, description, and a lesson count from 1 to 50.", true);
		return;
	}
	showLesson(0);
	setTeacherStatus("");
});

document.querySelector("#lesson-back").addEventListener("click", () => {
	if (currentLessonIndex === 0) {
		showCourseDetails();
		return;
	}
	showLesson(currentLessonIndex - 1);
	setTeacherStatus("");
});

document.querySelector("#lesson-next").addEventListener("click", () => {
	if (!validateCurrentLesson()) {
		return;
	}
	showLesson(currentLessonIndex + 1);
	setTeacherStatus("");
});

async function saveCourse() {
	setTeacherStatus("");
	if (!activeCourse || currentLessonIndex !== activeCourse.lessons.length - 1 || !validateCurrentLesson()) {
		return;
	}
	activeCourse.title = document.querySelector("#course-title").value.trim();
	activeCourse.description = document.querySelector("#course-description").value.trim();
	const saveButton = document.querySelector("#save-course");
	saveButton.disabled = true;
	saveButton.textContent = "Saving...";
	try {
		const { error } = await supabaseClient.from("course_content").upsert({
			id: activeCourse.id,
			content: activeCourse,
			updated_at: new Date().toISOString()
		}, { onConflict: "id" });
		if (error) {
			throw error;
		}
		const currentPaths = new Set(activeCourse.lessons.flatMap((lesson) => lesson.resources.map((resource) => resource.path).filter(Boolean)));
		const removedPaths = (originalCourse?.lessons || []).flatMap((lesson) => lesson.resources || []).map((resource) => resource.path).filter((path) => path && !currentPaths.has(path));
		if (removedPaths.length) {
			const { error: deleteError } = await supabaseClient.storage.from("course-materials").remove(removedPaths);
			if (deleteError) {
				setTeacherStatus("Course saved, but one or more removed files could not be deleted.", true);
			} else {
				setTeacherStatus("Course and lessons saved.");
			}
		} else {
			setTeacherStatus("Course and lessons saved.");
		}
		window.location.replace(`teacher.html?view=overview&course=${encodeURIComponent(activeCourse.id)}`);
	} catch (error) {
		setTeacherStatus(error.message || "Course could not be saved. Check the database and storage setup.", true);
	} finally {
		saveButton.disabled = false;
		saveButton.textContent = "Save course";
	}
}

document.querySelector("#save-course").addEventListener("click", saveCourse);

function appendPreviewText(parent, tag, text, className) {
	const element = document.createElement(tag);
	element.textContent = text;
	if (className) {
		element.className = className;
	}
	parent.append(element);
	return element;
}

async function renderCoursePreview(course) {
	teacherPageTitle.textContent = "Course overview.";
	previewCourse = course;
	teacherEditorView.hidden = true;
	teacherOverview.hidden = false;
	const preview = document.querySelector("#teacher-course-preview");
	preview.replaceChildren();
	appendPreviewText(preview, "p", `${course.lessons.length} ${course.lessons.length === 1 ? "lesson" : "lessons"}`, "course-index");
	appendPreviewText(preview, "h2", course.title, "teacher-preview-title");
	appendPreviewText(preview, "p", course.description, "course-description");
	const lessons = document.createElement("ol");
	lessons.className = "teacher-preview-lessons";
	for (const [index, lesson] of course.lessons.entries()) {
		const item = document.createElement("li");
		item.className = "teacher-preview-lesson";
		appendPreviewText(item, "p", `LESSON ${String(index + 1).padStart(2, "0")}`, "eyebrow");
		appendPreviewText(item, "h3", lesson.title);
		appendPreviewText(item, "p", lesson.summary || "", "teacher-preview-summary");
		for (const section of lesson.sections || []) {
			if (section.heading) {
				appendPreviewText(item, "h4", section.heading);
			}
			(section.paragraphs || []).forEach((text) => appendPreviewText(item, "p", text));
			if (section.points?.length) {
				const points = document.createElement("ul");
				section.points.forEach((text) => appendPreviewText(points, "li", text));
				item.append(points);
			}
		}
		for (const resource of lesson.resources || []) {
			let href = resource.url;
			if (resource.path) {
				const { data, error } = await supabaseClient.storage.from("course-materials").createSignedUrl(resource.path, 3600);
				if (error) {
					continue;
				}
				href = data.signedUrl;
			}
			try {
				const parsed = new URL(href);
				if (!['https:', 'http:'].includes(parsed.protocol)) {
					continue;
				}
				const resourceLink = document.createElement("a");
				resourceLink.href = parsed.href;
				resourceLink.target = "_blank";
				resourceLink.rel = "noopener noreferrer";
				resourceLink.textContent = resource.title || resource.name || "Open material";
				item.append(resourceLink);
			} catch {
				continue;
			}
		}
		lessons.append(item);
	}
	preview.append(lessons);
	document.querySelector("#overview-title").textContent = `${course.title} overview`;
}

document.querySelector("#edit-preview-course").addEventListener("click", () => {
	if (previewCourse) {
		window.location.assign(`teacher.html?edit=${encodeURIComponent(previewCourse.id)}`);
	}
});

document.querySelector("#teacher-sign-out").addEventListener("click", async () => {
	await supabaseClient.auth.signOut();
	window.location.replace("index.html");
});

async function initializeTeacherPage() {
	if (!supabaseClient) {
		teacherWorkspace.hidden = true;
		teacherAccess.hidden = false;
		document.querySelector("#teacher-access-message").textContent = "Secure course authoring is not configured.";
		setTeacherStatus("");
		return;
	}
	const { data, error } = await supabaseClient.auth.getSession();
	const user = data.session?.user;
	if (error || !user || user.app_metadata?.role !== "admin") {
		teacherWorkspace.hidden = true;
		teacherAccess.hidden = false;
		document.querySelector("#teacher-access-message").textContent = user ? "This account is not authorized to create courses." : "Sign in with an authorized teacher account to create and manage courses.";
		document.querySelector("#teacher-sign-in").hidden = Boolean(user);
		setTeacherStatus("");
		return;
	}
	document.querySelector("#teacher-email").textContent = user.email || "Teacher";
	document.querySelector("#teacher-account").hidden = false;
	teacherWorkspace.hidden = false;
	await loadCourses();
	const params = new URLSearchParams(window.location.search);
	let routeError = "";
	if (params.get("view") === "overview") {
		const course = savedCourses.find((item) => item.id === params.get("course"));
		if (course) {
			await renderCoursePreview(course);
		} else {
			routeError = "The saved course could not be found.";
		}
	} else if (params.has("edit")) {
		const course = savedCourses.find((item) => item.id === params.get("edit"));
		if (course) {
			coursePicker.value = course.id;
			editCourse(course);
		} else {
			routeError = "The course could not be found.";
		}
	}
	setTeacherStatus(routeError, Boolean(routeError));
}

initializeTeacherPage().catch((error) => setTeacherStatus(error.message || "Teacher studio could not be loaded.", true));