const loginForm = document.querySelector("#admin-login-form");
const loginPanel = document.querySelector("#admin-login");
const loginSubmit = document.querySelector("#admin-login-submit");
const workspace = document.querySelector("#admin-workspace");
const accountSummary = document.querySelector("#admin-account");
const editor = document.querySelector("#course-content-editor");
const statusMessage = document.querySelector("#admin-status");
const saveButton = document.querySelector("#save-course");
const resetButton = document.querySelector("#reset-progress");

function setAdminStatus(message, isError = false) {
	statusMessage.textContent = message;
	statusMessage.classList.toggle("is-error", isError);
	statusMessage.hidden = !message;
}

function validateCourseContent(content) {
	if (!content || typeof content !== "object" || Array.isArray(content)) {
		throw new Error("The JSON must be a course object.");
	}
	if (content.id !== COURSE.id) {
		throw new Error(`The course id must remain "${COURSE.id}".`);
	}
	if (typeof content.title !== "string" || !content.title.trim()) {
		throw new Error("Add a course title.");
	}
	if (typeof content.description !== "string" || !content.description.trim()) {
		throw new Error("Add a course description.");
	}
	if (!Array.isArray(content.lessons) || content.lessons.length !== COURSE.lessons.length) {
		throw new Error("Keep the existing lessons and their count so lesson links continue to work.");
	}

	content.lessons.forEach((lesson, index) => {
		if (lesson.id !== COURSE.lessons[index].id) {
			throw new Error("Lesson ids and order must stay the same so lesson links continue to work.");
		}
		if (typeof lesson.title !== "string" || !lesson.title.trim() || typeof lesson.summary !== "string") {
			throw new Error(`Lesson ${index + 1} needs a title and summary.`);
		}
		if (!Array.isArray(lesson.sections) || lesson.sections.length === 0) {
			throw new Error(`Lesson ${index + 1} needs at least one section.`);
		}
		lesson.sections.forEach((section) => {
			if (typeof section.heading !== "string" || !section.heading.trim() || !Array.isArray(section.paragraphs) || !section.paragraphs.every((text) => typeof text === "string")) {
				throw new Error(`Every section in lesson ${index + 1} needs a heading and a paragraphs array.`);
			}
			if (section.points !== undefined && (!Array.isArray(section.points) || !section.points.every((text) => typeof text === "string"))) {
				throw new Error(`Bullet points in lesson ${index + 1} must be an array of text.`);
			}
		});
	});

	return content;
}

async function showAdmin(user) {
	if (user.app_metadata?.role !== "admin") {
		await supabaseClient.auth.signOut();
		throw new Error("This account is not authorized to access administration.");
	}

	document.querySelector("#admin-email").textContent = user.email;
	loginPanel.hidden = true;
	workspace.hidden = false;
	accountSummary.hidden = false;
	setAdminStatus("");

	const { data, error } = await supabaseClient
		.from("course_content")
		.select("content")
		.eq("id", COURSE.id)
		.maybeSingle();

	if (error) {
		editor.value = JSON.stringify(COURSE, null, 2);
		setAdminStatus("Could not load saved course content. Confirm the admin SQL setup has been run.", true);
		return;
	}

	editor.value = JSON.stringify(data?.content || COURSE, null, 2);
}

loginForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	setAdminStatus("");
	loginSubmit.disabled = true;
	loginSubmit.textContent = "Signing in...";

	try {
		if (!supabaseClient) {
			throw new Error("Secure sign-in is not configured.");
		}
		const { data, error } = await supabaseClient.auth.signInWithPassword({
			email: document.querySelector("#admin-login-email").value.trim(),
			password: document.querySelector("#admin-login-password").value
		});
		if (error) {
			throw error;
		}
		await showAdmin(data.user);
	} catch (error) {
		setAdminStatus(error.message || "Sign in failed. Please try again.", true);
	} finally {
		loginSubmit.disabled = false;
		loginSubmit.textContent = "Sign in";
	}
});

saveButton.addEventListener("click", async () => {
	setAdminStatus("");
	saveButton.disabled = true;
	saveButton.textContent = "Saving...";

	try {
		const content = validateCourseContent(JSON.parse(editor.value));
		const { error } = await supabaseClient.from("course_content").upsert({
			id: COURSE.id,
			content,
			updated_at: new Date().toISOString()
		}, { onConflict: "id" });
		if (error) {
			throw error;
		}
		setAdminStatus("Course changes saved.");
	} catch (error) {
		setAdminStatus(error instanceof SyntaxError ? "Course content is not valid JSON." : error.message || "Course changes could not be saved.", true);
	} finally {
		saveButton.disabled = false;
		saveButton.textContent = "Save course changes";
	}
});

resetButton.addEventListener("click", async () => {
	const confirmation = window.prompt(`Type "${COURSE.title}" to permanently clear all student progress and feedback.`);
	if (confirmation?.trim() !== COURSE.title) {
		return;
	}

	setAdminStatus("");
	resetButton.disabled = true;
	resetButton.textContent = "Clearing...";
	try {
		const { data, error } = await supabaseClient
			.from("lesson_progress")
			.delete()
			.eq("course_id", COURSE.id)
			.select("lesson_id");
		if (error) {
			throw error;
		}
		const { error: feedbackError } = await supabaseClient
			.from("course_feedback")
			.delete()
			.eq("course_id", COURSE.id);
		if (feedbackError) {
			throw feedbackError;
		}
		setAdminStatus(`Cleared ${data.length} saved lesson completion${data.length === 1 ? "" : "s"} and course feedback.`);
	} catch (error) {
		setAdminStatus(error.message || "Student progress could not be cleared.", true);
	} finally {
		resetButton.disabled = false;
		resetButton.textContent = "Clear all student progress";
	}
});

document.querySelector("#admin-sign-out").addEventListener("click", async () => {
	await supabaseClient.auth.signOut();
	window.location.reload();
});

if (!supabaseClient) {
	loginSubmit.disabled = true;
	setAdminStatus("Secure sign-in is not configured. Set the Supabase URL and anon key in js/supabase-config.js.", true);
} else {
	supabaseClient.auth.getSession().then(async ({ data }) => {
		if (data.session) {
			try {
				await showAdmin(data.session.user);
			} catch (error) {
				setAdminStatus(error.message, true);
			}
		}
	});
}