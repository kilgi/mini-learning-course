const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const configMessage = document.querySelector("#config-message");
const submitButton = document.querySelector("#auth-submit");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const nameField = document.querySelector("#name-field");
const nameInput = document.querySelector("#display-name");
const modeButtons = [...document.querySelectorAll("[data-auth-mode]")];
let authMode = "signin";

function setAuthMode(mode) {
	authMode = mode;
	const signingUp = mode === "signup";
	nameField.hidden = !signingUp;
	nameInput.required = signingUp;
	passwordInput.autocomplete = signingUp ? "new-password" : "current-password";
	submitButton.textContent = signingUp ? "Create account" : "Sign in";
	authMessage.hidden = true;
	modeButtons.forEach((button) => {
		const selected = button.dataset.authMode === mode;
		button.setAttribute("aria-pressed", String(selected));
	});
}

modeButtons.forEach((button) => {
	button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

authForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	authMessage.hidden = true;
	submitButton.disabled = true;
	submitButton.textContent = authMode === "signup" ? "Creating account..." : "Signing in...";

	try {
		if (authMode === "signup") {
			const { data, error } = await supabaseClient.auth.signUp({
				email: emailInput.value.trim(),
				password: passwordInput.value,
				options: { data: { display_name: nameInput.value.trim() } }
			});
			if (error) {
				throw error;
			}
			if (data.session) {
				window.location.replace("index.html");
				return;
			}
			authMessage.textContent = "Account created. Check your email to confirm it, then sign in.";
		} else {
			const { error } = await supabaseClient.auth.signInWithPassword({
				email: emailInput.value.trim(),
				password: passwordInput.value
			});
			if (error) {
				throw error;
			}
			window.location.replace("index.html");
			return;
		}
	} catch (error) {
		authMessage.textContent = error.message || "Sign in failed. Please try again.";
	}

	authMessage.hidden = false;
	submitButton.disabled = false;
	submitButton.textContent = authMode === "signup" ? "Create account" : "Sign in";
});

if (!supabaseClient) {
	configMessage.hidden = false;
	submitButton.disabled = true;
	modeButtons.forEach((button) => {
		button.disabled = true;
	});
} else {
	supabaseClient.auth.getSession().then(({ data }) => {
		if (data.session) {
			window.location.replace("index.html");
		}
	});
}