const teacherWorkspace = document.querySelector("#teacher-workspace");
const teacherAccess = document.querySelector("#teacher-access");
const teacherStatus = document.querySelector("#teacher-status");
const teacherDashboard = document.querySelector("#teacher-dashboard");
const courseGrid = document.querySelector("#teacher-course-grid");
const emptyState = document.querySelector("#teacher-empty-state");
const teacherEditor = document.querySelector("#teacher-editor");
const outlineItems = document.querySelector("#teacher-outline-items");
const editingArea = document.querySelector("#teacher-editing-area");
const teacherOverview = document.querySelector("#teacher-overview");
const deleteCourseZone = document.querySelector("#delete-course-zone");
const deleteCourseConfirmation = document.querySelector("#delete-course-confirmation");
const deleteCourseTitle = document.querySelector("#delete-course-title");
const confirmDeleteCourseButton = document.querySelector("#confirm-delete-course");
let savedCourses = [];
let currentUserId = null;
let activeCourse = null;
let originalCourse = null;
let selectedItem = { type: "details", id: "details" };
let previewCourse = null;

function setTeacherStatus(message, isError = false) {
	teacherStatus.textContent = message;
	teacherStatus.classList.toggle("is-error", isError);
	teacherStatus.hidden = !message;
}

function newId(prefix) {
	return `${prefix}-${crypto.randomUUID()}`;
}

function newCourseId(title) {
	const slug = title.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60)
		.replace(/-+$/g, "") || "course";
	return `${slug}-${crypto.randomUUID().slice(0, 8)}`;
}

function ensureCourseId() {
	if (activeCourse && !activeCourse.id && activeCourse.title.trim()) {
		activeCourse.id = newCourseId(activeCourse.title.trim());
	}
}

function getCourseSaveErrorMessage(error) {
	if (error?.code === "23505") {
		return "A course with that ID already exists. Start a new course and try again.";
	}
	if (error?.code === "42501") {
		return "Supabase did not allow this save. Confirm you own this course and try again.";
	}
	return "The course could not be saved. Check your connection and try again.";
}

function createLessonDraft() {
	return { id: newId("lesson"), title: "", summary: "", sections: [{ heading: "Lesson", paragraphs: [] }], resources: [] };
}

function isLessonComplete(lesson) {
	return Boolean(lesson.title?.trim()
		&& lesson.summary?.trim()
		&& lesson.sections?.some((section) => section.paragraphs?.some((text) => text.trim())));
}

function getCourseStatusText(course) {
	return course.published ? "✓ Published" : "Draft";
}

function createStatusBadge(course) {
	const badge = document.createElement("span");
	badge.className = `teacher-status-badge${course.published ? " is-published" : ""}`;
	badge.textContent = getCourseStatusText(course);
	return badge;
}

function showView(view) {
	teacherDashboard.hidden = view !== "dashboard";
	teacherEditor.hidden = view !== "editor";
	teacherOverview.hidden = view !== "preview";
}

function createButton(text, className, onClick, label = "") {
	const button = document.createElement("button");
	button.type = "button";
	button.className = className;
	button.textContent = text;
	if (label) {
		button.setAttribute("aria-label", label);
	}
	button.addEventListener("click", onClick);
	return button;
}

function renderCourseCards() {
	courseGrid.replaceChildren();
	const createCard = createButton("+ Create a new course", "teacher-create-tile", createCourse);
	createCard.setAttribute("aria-label", "Create a new course");
	courseGrid.append(createCard);

	for (const course of savedCourses) {
		const card = document.createElement("article");
		card.className = "teacher-course-card";
		const header = document.createElement("div");
		header.className = "teacher-course-card-heading";
		const title = document.createElement("h3");
		title.textContent = course.title || "Untitled course";
		header.append(title, createStatusBadge(course));
		const description = document.createElement("p");
		description.className = "teacher-course-card-description";
		description.textContent = course.description || "No description yet.";
		const lessonCount = document.createElement("p");
		lessonCount.className = "teacher-course-card-count";
		lessonCount.textContent = `${course.lessons.length} ${course.lessons.length === 1 ? "lesson" : "lessons"}`;
		const actions = document.createElement("div");
		actions.className = "teacher-course-card-actions";
		actions.append(
			createButton("Edit", "auth-submit teacher-card-edit", () => editCourse(course)),
			createButton("Preview", "teacher-secondary-button", () => renderCoursePreview(course)),
			createButton(course.published ? "Unpublish" : "Publish", "teacher-secondary-button", () => togglePublished(course))
		);
		card.append(header, description, lessonCount, actions);
		courseGrid.append(card);
	}
	emptyState.hidden = savedCourses.length !== 0;
}

function createField(labelText, helperText, value, options = {}) {
	const label = document.createElement("label");
	label.className = "teacher-field";
	const labelTextNode = document.createElement("span");
	labelTextNode.textContent = labelText;
	const input = options.multiline ? document.createElement("textarea") : document.createElement("input");
	input.value = value || "";
	input.maxLength = options.maxLength || 600;
	input.required = Boolean(options.required);
	if (options.multiline) {
		input.rows = options.rows || 5;
	} else if (options.type) {
		input.type = options.type;
	}
	const helper = document.createElement("span");
	helper.className = "teacher-field-help";
	helper.textContent = helperText;
	const helperId = `teacher-help-${crypto.randomUUID()}`;
	helper.id = helperId;
	input.setAttribute("aria-describedby", helperId);
	label.append(labelTextNode, input, helper);
	return { label, input };
}

function renderDetailsEditor() {
	const heading = document.createElement("h2");
	heading.className = "teacher-editing-heading";
	heading.tabIndex = -1;
	heading.textContent = "Course details";
	const intro = document.createElement("p");
	intro.className = "teacher-editing-intro";
	intro.textContent = "Start with a clear name and a short description for your students.";
	const titleField = createField("Course name", "Use a short title students will recognize. Up to 120 characters.", activeCourse.title, { maxLength: 120, required: true });
	titleField.input.addEventListener("input", () => {
		activeCourse.title = titleField.input.value;
		if (selectedItem.type === "details") {
			document.querySelector("#editor-page-title").textContent = activeCourse.title || "New course";
		}
		refreshOutline();
	});
	const descriptionField = createField("Description", "Explain what students will learn. Up to 600 characters.", activeCourse.description, { maxLength: 600, required: true, multiline: true, rows: 5 });
	descriptionField.input.addEventListener("input", () => { activeCourse.description = descriptionField.input.value; });
	const save = createButton("Save course", "auth-submit teacher-save-button", saveCourse);
	editingArea.replaceChildren(heading, intro, titleField.label, descriptionField.label, save);
	heading.focus({ preventScroll: true });
}

function addResourceField(lesson, index, resourceList) {
	const resourceForm = document.createElement("div");
	resourceForm.className = "teacher-resource-form";
	const resourceName = document.createElement("input");
	resourceName.placeholder = "Resource name";
	resourceName.setAttribute("aria-label", `Resource name for lesson ${index + 1}`);
	const resourceUrl = document.createElement("input");
	resourceUrl.type = "url";
	resourceUrl.placeholder = "https://...";
	resourceUrl.setAttribute("aria-label", `Resource URL for lesson ${index + 1}`);
	const addUrl = createButton("Add link", "teacher-secondary-button", () => {
		try {
			const parsed = new URL(resourceUrl.value);
			if (!['https:', 'http:'].includes(parsed.protocol)) {
				throw new Error();
			}
			lesson.resources.push({ title: resourceName.value.trim() || parsed.hostname, url: parsed.href });
			resourceName.value = "";
			resourceUrl.value = "";
			renderResourceList(lesson, resourceList);
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
		ensureCourseId();
		if (!activeCourse.id) {
			setTeacherStatus("Add a course name before uploading course materials.", true);
			fileInput.value = "";
			return;
		}
		fileInput.disabled = true;
		setTeacherStatus("Uploading course material...");
		try {
			const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
			const path = `${currentUserId}/${activeCourse.id}/${crypto.randomUUID()}-${safeName}`;
			const { error } = await supabaseClient.storage.from("course-materials").upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
			if (error) {
				throw error;
			}
			lesson.resources.push({ title: resourceName.value.trim() || file.name, name: file.name, path });
			resourceName.value = "";
			renderResourceList(lesson, resourceList);
			setTeacherStatus("Material uploaded. Save the course to keep it.");
		} catch (error) {
			setTeacherStatus(error.message || "The file could not be uploaded.", true);
		} finally {
			fileInput.disabled = false;
			fileInput.value = "";
		}
	});
	resourceForm.append(resourceName, resourceUrl, addUrl, fileInput);
	return resourceForm;
}

function renderResourceList(lesson, list) {
	list.replaceChildren();
	lesson.resources.forEach((resource, index) => {
		const row = document.createElement("li");
		const label = document.createElement("span");
		label.textContent = `${resource.title || resource.name || "Resource"}${resource.path ? " (uploaded file)" : " (link)"}`;
		const remove = createButton("Remove", "teacher-remove-button", () => {
			lesson.resources.splice(index, 1);
			renderResourceList(lesson, list);
		}, `Remove ${resource.title || resource.name || "resource"}`);
		row.append(label, remove);
		list.append(row);
	});
}

function renderLessonEditor(lesson, index) {
	const heading = document.createElement("h2");
	heading.className = "teacher-editing-heading";
	heading.tabIndex = -1;
	heading.textContent = lesson.title || `Lesson ${index + 1}`;
	const intro = document.createElement("p");
	intro.className = "teacher-editing-intro";
	intro.textContent = "Add a title, a short summary, and the lesson content. You can save and come back later.";
	const titleField = createField("Lesson title", "Give this lesson a clear, memorable name.", lesson.title, { maxLength: 120 });
	titleField.input.addEventListener("input", () => {
		lesson.title = titleField.input.value;
		if (lesson.sections[0]) {
			lesson.sections[0].heading = lesson.title || "Lesson";
		}
		heading.textContent = lesson.title || `Lesson ${index + 1}`;
		refreshOutline();
	});
	const summaryField = createField("Short summary", "A sentence to help students know what this lesson covers.", lesson.summary, { maxLength: 300 });
	summaryField.input.addEventListener("input", () => {
		lesson.summary = summaryField.input.value;
		refreshOutline();
	});
	const bodyValue = (lesson.sections || []).flatMap((section) => section.paragraphs || []).join("\n\n");
	const bodyField = createField("Lesson text", "Separate paragraphs with a blank line.", bodyValue, { multiline: true, rows: 8 });
	bodyField.input.addEventListener("input", () => {
		lesson.sections = [{ heading: lesson.title || "Lesson", paragraphs: bodyField.input.value.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean) }];
		refreshOutline();
	});
	const resourceHeading = document.createElement("h3");
	resourceHeading.className = "teacher-resource-heading";
	resourceHeading.textContent = "Course materials and links";
	const resourceHelp = document.createElement("p");
	resourceHelp.className = "teacher-field-help teacher-resource-help";
	resourceHelp.textContent = "Add a web link or upload a PDF or Word document up to 20 MB.";
	const resources = document.createElement("ul");
	resources.className = "teacher-resource-list";
	renderResourceList(lesson, resources);
	const resourceForm = addResourceField(lesson, index, resources);
	const save = createButton("Save course", "auth-submit teacher-save-button", saveCourse);
	editingArea.replaceChildren(heading, intro, titleField.label, summaryField.label, bodyField.label, resourceHeading, resourceHelp, resources, resourceForm, save);
	heading.focus({ preventScroll: true });
}

function refreshOutline() {
	if (!activeCourse) {
		return;
	}
	document.querySelector("#editor-page-title").textContent = activeCourse.title || "New course";
	document.querySelector("#editor-status").replaceWith(createStatusBadge(activeCourse));
	const statusBadge = document.querySelector("#teacher-editor .teacher-status-badge");
	statusBadge.id = "editor-status";
	outlineItems.replaceChildren();
	const detailsButton = createButton("Course details", `teacher-outline-item${selectedItem.type === "details" ? " is-selected" : ""}`, () => selectItem("details", "details"));
	detailsButton.setAttribute("aria-current", selectedItem.type === "details" ? "page" : "false");
	outlineItems.append(detailsButton);
	const lessonList = document.createElement("ol");
	lessonList.className = "teacher-outline-lessons";
	activeCourse.lessons.forEach((lesson, index) => {
		const row = document.createElement("li");
		row.className = "teacher-outline-row";
		const select = createButton("", `teacher-outline-item teacher-outline-lesson${selectedItem.id === lesson.id ? " is-selected" : ""}`, () => selectItem("lesson", lesson.id));
		select.setAttribute("aria-current", selectedItem.id === lesson.id ? "page" : "false");
		const number = document.createElement("span");
		number.className = "teacher-outline-number";
		number.textContent = String(index + 1);
		const copy = document.createElement("span");
		copy.className = "teacher-outline-copy";
		const title = document.createElement("span");
		title.className = "teacher-outline-title";
		title.textContent = lesson.title?.trim() || "Untitled lesson";
		const completion = document.createElement("span");
		completion.className = "teacher-outline-completion";
		completion.textContent = isLessonComplete(lesson) ? "Complete" : "Needs content";
		copy.append(title, completion);
		select.append(number, copy);
		const controls = document.createElement("div");
		controls.className = "teacher-outline-controls";
		controls.append(
			createButton("Up", "teacher-outline-control", () => moveLesson(index, -1), `Move lesson ${index + 1} up`),
			createButton("Down", "teacher-outline-control", () => moveLesson(index, 1), `Move lesson ${index + 1} down`),
			createButton("Delete", "teacher-outline-control teacher-outline-delete", () => deleteLesson(index), `Delete lesson ${index + 1}`)
		);
		controls.children[0].disabled = index === 0;
		controls.children[1].disabled = index === activeCourse.lessons.length - 1;
		row.append(select, controls);
		lessonList.append(row);
	});
	outlineItems.append(lessonList);
	const addButton = document.querySelector("#add-lesson");
	addButton.disabled = activeCourse.lessons.length >= 50;
	if (selectedItem.type === "lesson" && !activeCourse.lessons.some((lesson) => lesson.id === selectedItem.id)) {
		selectedItem = { type: "details", id: "details" };
	}
}

function selectItem(type, id) {
	selectedItem = { type, id };
	refreshOutline();
	if (type === "details") {
		renderDetailsEditor();
	} else {
		const index = activeCourse.lessons.findIndex((lesson) => lesson.id === id);
		renderLessonEditor(activeCourse.lessons[index], index);
	}
}

function moveLesson(index, direction) {
	const target = index + direction;
	if (target < 0 || target >= activeCourse.lessons.length) {
		return;
	}
	[activeCourse.lessons[index], activeCourse.lessons[target]] = [activeCourse.lessons[target], activeCourse.lessons[index]];
	refreshOutline();
}

function deleteLesson(index) {
	const lesson = activeCourse.lessons[index];
	if (!window.confirm(`Delete “${lesson.title || `Lesson ${index + 1}`}”?`)) {
		return;
	}
	activeCourse.lessons.splice(index, 1);
	if (selectedItem.id === lesson.id) {
		selectedItem = { type: "details", id: "details" };
	}
	selectItem(selectedItem.type, selectedItem.id);
}

function editCourse(course) {
	activeCourse = JSON.parse(JSON.stringify(course));
	originalCourse = JSON.parse(JSON.stringify(course));
	activeCourse.lessons ||= [];
	activeCourse.lessons.forEach((lesson) => { lesson.resources ||= []; });
	selectedItem = { type: "details", id: "details" };
	showView("editor");
	refreshOutline();
	selectItem("details", "details");
	setTeacherStatus("");
}

function createCourse() {
	activeCourse = { id: "", title: "", description: "", lessons: [], published: false, teacher_id: currentUserId };
	originalCourse = null;
	selectedItem = { type: "details", id: "details" };
	showView("editor");
	refreshOutline();
	selectItem("details", "details");
	setTeacherStatus("");
}

function showDashboard() {
	showView("dashboard");
	activeCourse = null;
	originalCourse = null;
	previewCourse = null;
	renderCourseCards();
}

async function loadCourses() {
	const { data, error } = await supabaseClient.from("course_content").select("id, content, published, teacher_id").eq("teacher_id", currentUserId).order("updated_at", { ascending: false });
	if (error) {
		throw error;
	}
	savedCourses = (data || []).map((row) => ({ ...row.content, id: row.id, published: row.published, teacher_id: row.teacher_id }));
	renderCourseCards();
}

async function saveCourse() {
	setTeacherStatus("");
	if (!activeCourse.title?.trim() || !activeCourse.description?.trim()) {
		selectItem("details", "details");
		setTeacherStatus("Add a course name and description before saving.", true);
		return;
	}
	activeCourse.title = activeCourse.title.trim();
	activeCourse.description = activeCourse.description.trim();
	ensureCourseId();
	const previousCourse = originalCourse ? JSON.parse(JSON.stringify(originalCourse)) : null;
	const saveButton = editingArea.querySelector(".teacher-save-button");
	saveButton.disabled = true;
	saveButton.textContent = "Saving...";
	try {
		const content = { ...activeCourse };
		delete content.published;
		delete content.teacher_id;
		const { error } = await supabaseClient.from("course_content").upsert({
			id: activeCourse.id,
			content,
			teacher_id: currentUserId,
			updated_at: new Date().toISOString()
		}, { onConflict: "id" });
		if (error) {
			throw error;
		}
		const savedCourse = JSON.parse(JSON.stringify(activeCourse));
		savedCourses = previousCourse
			? savedCourses.map((course) => course.id === savedCourse.id ? savedCourse : course)
			: [...savedCourses, savedCourse];
		activeCourse = savedCourse;
		originalCourse = JSON.parse(JSON.stringify(savedCourse));
		const currentPaths = new Set(savedCourse.lessons.flatMap((lesson) => lesson.resources.map((resource) => resource.path).filter(Boolean)));
		const removedPaths = (previousCourse?.lessons || []).flatMap((lesson) => lesson.resources || []).map((resource) => resource.path).filter((path) => path && !currentPaths.has(path));
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
		renderCourseCards();
		refreshOutline();
	} catch (error) {
		setTeacherStatus(getCourseSaveErrorMessage(error), true);
	} finally {
		if (saveButton.isConnected) {
			saveButton.disabled = false;
			saveButton.textContent = "Save course";
		}
	}
}

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
	previewCourse = course;
	const isOwnedCourse = course.teacher_id === currentUserId && savedCourses.some((savedCourse) => savedCourse.id === course.id && savedCourse.teacher_id === currentUserId);
	deleteCourseZone.hidden = !isOwnedCourse;
	deleteCourseConfirmation.hidden = true;
	deleteCourseTitle.value = "";
	confirmDeleteCourseButton.disabled = true;
	document.querySelector("#toggle-publish").textContent = course.published ? "Unpublish" : "Publish";
	document.querySelector("#preview-status").replaceWith(createStatusBadge(course));
	document.querySelector("#teacher-overview .teacher-status-badge").id = "preview-status";
	showView("preview");
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
		appendPreviewText(item, "h3", lesson.title || "Untitled lesson");
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
	document.querySelector("#overview-title").textContent = `${course.title} preview`;
}

function getCourseFilePaths(course) {
	return [...new Set((course.lessons || []).flatMap((lesson) => lesson.resources || [])
		.map((resource) => resource.path)
		.filter((path) => typeof path === "string" && path.length > 0))];
}

function canDeletePreviewCourse() {
	return Boolean(previewCourse
		&& previewCourse.teacher_id === currentUserId
		&& savedCourses.some((course) => course.id === previewCourse.id && course.teacher_id === currentUserId));
}

document.querySelector("#empty-create-course").addEventListener("click", createCourse);
document.querySelector("#back-to-courses").addEventListener("click", showDashboard);
document.querySelector("#preview-back").addEventListener("click", showDashboard);
document.querySelector("#add-lesson").addEventListener("click", () => {
	if (activeCourse.lessons.length >= 50) {
		return;
	}
	const lesson = createLessonDraft();
	activeCourse.lessons.push(lesson);
	selectItem("lesson", lesson.id);
});

document.querySelector("#start-delete-course").addEventListener("click", () => {
	if (!canDeletePreviewCourse()) {
		return;
	}
	document.querySelector("#delete-course-warning").textContent = `This will permanently delete “${previewCourse.title}”, its uploaded files, and all student progress and feedback for this course.`;
	deleteCourseZone.hidden = true;
	deleteCourseConfirmation.hidden = false;
	deleteCourseTitle.value = "";
	confirmDeleteCourseButton.disabled = true;
	deleteCourseTitle.focus();
});

deleteCourseTitle.addEventListener("input", () => {
	confirmDeleteCourseButton.disabled = deleteCourseTitle.value !== previewCourse?.title;
});

document.querySelector("#cancel-delete-course").addEventListener("click", () => {
	deleteCourseConfirmation.hidden = true;
	deleteCourseTitle.value = "";
	confirmDeleteCourseButton.disabled = true;
	deleteCourseZone.hidden = !canDeletePreviewCourse();
});

confirmDeleteCourseButton.addEventListener("click", async () => {
	if (!canDeletePreviewCourse() || deleteCourseTitle.value !== previewCourse.title) {
		return;
	}
	const course = previewCourse;
	const startButton = document.querySelector("#start-delete-course");
	const cancelButton = document.querySelector("#cancel-delete-course");
	let fileDeletionFailed = false;
	confirmDeleteCourseButton.disabled = true;
	confirmDeleteCourseButton.textContent = "Deleting...";
	startButton.disabled = true;
	cancelButton.disabled = true;
	deleteCourseTitle.disabled = true;
	setTeacherStatus("Deleting the course and its related data...");
	try {
		const paths = getCourseFilePaths(course);
		if (paths.length) {
			const { error } = await supabaseClient.storage.from("course-materials").remove(paths);
			if (error) {
				fileDeletionFailed = true;
				throw error;
			}
		}
		const { error } = await supabaseClient.rpc("delete_owned_course", { p_course_id: course.id });
		if (error) {
			throw error;
		}
		savedCourses = savedCourses.filter((savedCourse) => savedCourse.id !== course.id);
		deleteCourseZone.hidden = true;
		deleteCourseConfirmation.hidden = true;
		showDashboard();
		setTeacherStatus("The course, its files, and all student progress and feedback were permanently deleted.");
	} catch {
		if (fileDeletionFailed) {
			setTeacherStatus("File removal did not complete, so the course and its student data were not deleted. Some files may already have been removed; check access and try again.", true);
		} else {
			setTeacherStatus("The course record and its student data could not be deleted. Its files may already have been removed; try again or contact the project admin.", true);
		}
	} finally {
		if (!deleteCourseConfirmation.hidden) {
			confirmDeleteCourseButton.disabled = deleteCourseTitle.value !== previewCourse?.title;
			confirmDeleteCourseButton.textContent = "Delete permanently";
			startButton.disabled = false;
			cancelButton.disabled = false;
			deleteCourseTitle.disabled = false;
		}
	}
});

async function togglePublished(course) {
	const button = document.activeElement;
	if (!course) {
		return;
	}
	if (button instanceof HTMLButtonElement) {
		button.disabled = true;
	}
	const published = !course.published;
	try {
		const { error } = await supabaseClient.from("course_content")
			.update({ published, updated_at: new Date().toISOString() })
			.eq("id", course.id)
			.eq("teacher_id", currentUserId);
		if (error) {
			throw error;
		}
		const updatedCourse = { ...course, published };
		savedCourses = savedCourses.map((item) => item.id === course.id ? updatedCourse : item);
		if (activeCourse?.id === course.id) {
			activeCourse = { ...activeCourse, published };
		}
		if (originalCourse?.id === course.id) {
			originalCourse = { ...originalCourse, published };
		}
		if (previewCourse?.id === course.id) {
			previewCourse = updatedCourse;
		}
		renderCourseCards();
		if (previewCourse?.id === course.id) {
			document.querySelector("#toggle-publish").textContent = published ? "Unpublish" : "Publish";
			document.querySelector("#preview-status").replaceWith(createStatusBadge(updatedCourse));
			document.querySelector("#teacher-overview .teacher-status-badge").id = "preview-status";
		}
		if (activeCourse?.id === course.id) {
			refreshOutline();
		}
		setTeacherStatus(published ? "Course published." : "Course unpublished.");
	} catch (error) {
		setTeacherStatus(error.message || "Publication status could not be changed.", true);
	} finally {
		if (button instanceof HTMLButtonElement && button.isConnected) {
			button.disabled = false;
		}
	}
}

document.querySelector("#toggle-publish").addEventListener("click", () => togglePublished(previewCourse));
document.querySelector("#edit-preview-course").addEventListener("click", () => {
	if (previewCourse) {
		editCourse(previewCourse);
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
	if (error || !user || !["teacher", "admin"].includes(user.app_metadata?.role)) {
		teacherWorkspace.hidden = true;
		teacherAccess.hidden = false;
		document.querySelector("#teacher-access-message").textContent = user ? "This account is not authorized to create courses." : "Sign in with an authorized teacher account to create and manage courses.";
		document.querySelector("#teacher-sign-in").hidden = Boolean(user);
		setTeacherStatus("");
		return;
	}
	currentUserId = user.id;
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
			editCourse(course);
		} else {
			routeError = "The course could not be found.";
		}
	}
	setTeacherStatus(routeError, Boolean(routeError));
}

initializeTeacherPage().catch((error) => setTeacherStatus(error.message || "Teacher studio could not be loaded.", true));