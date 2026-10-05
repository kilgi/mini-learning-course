async function getCompletedLessons(userId, courseId) {
	if (!supabaseClient) {
		throw new Error("Supabase is not configured.");
	}

	const { data, error } = await supabaseClient
		.from("lesson_progress")
		.select("lesson_id")
		.eq("user_id", userId)
		.eq("course_id", courseId);

	if (error) {
		throw error;
	}

	return data.map((row) => row.lesson_id);
}

async function getCourseFeedback(userId, courseId) {
	if (!supabaseClient) {
		throw new Error("Supabase is not configured.");
	}

	const { data, error } = await supabaseClient
		.from("course_feedback")
		.select("feedback")
		.eq("user_id", userId)
		.eq("course_id", courseId)
		.maybeSingle();

	if (error) {
		throw error;
	}

	return data?.feedback || "";
}

async function saveCourseFeedback(userId, courseId, feedback) {
	if (!supabaseClient) {
		throw new Error("Supabase is not configured.");
	}

	const { error } = await supabaseClient.from("course_feedback").upsert({
		user_id: userId,
		course_id: courseId,
		feedback: feedback.trim(),
		updated_at: new Date().toISOString()
	}, { onConflict: "user_id,course_id" });

	if (error) {
		throw error;
	}
}

async function getCourseContent(fallbackCourse) {
	if (!supabaseClient) {
		return fallbackCourse;
	}

	try {
		const { data, error } = await supabaseClient
			.from("course_content")
			.select("content")
			.eq("id", fallbackCourse.id)
			.maybeSingle();

		if (error || !data?.content) {
			return fallbackCourse;
		}

		return data.content;
	} catch {
		return fallbackCourse;
	}
}

async function completeLesson(userId, courseId, lessonId) {
	if (!supabaseClient) {
		throw new Error("Supabase is not configured.");
	}

	const { error } = await supabaseClient.from("lesson_progress").insert({
		user_id: userId,
		course_id: courseId,
		lesson_id: lessonId
	});

	if (error?.code === "23505") {
		return false;
	}
	if (error) {
		throw error;
	}

	return true;
}
