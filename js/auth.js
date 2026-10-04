async function getCurrentUser() {
	if (!supabaseClient) {
		return null;
	}

	try {
		const { data, error } = await supabaseClient.auth.getUser();
		return error ? null : data.user;
	} catch {
		return null;
	}
}

function showAccount(user) {
	document.querySelectorAll("[data-account-email]").forEach((element) => {
		element.textContent = user.email || "Signed in";
	});
	document.querySelectorAll("[data-sign-out]").forEach((button) => {
		button.addEventListener("click", async () => {
			try {
				await supabaseClient.auth.signOut();
			} finally {
				window.location.replace("login.html");
			}
		});
	});
}