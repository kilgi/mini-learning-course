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
