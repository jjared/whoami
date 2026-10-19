export function createAuthDialog() {
    const dialog = document.getElementById("authDialog");
    const form = document.getElementById("authForm");
    const errorMessage = document.getElementById("authError");
    const submit = form.querySelector('[type="submit"]');
    const password = document.getElementById("adminPassword");
    let resolveLogin;
    let checking;

    for (const buttonId of ["closeAuthDialog", "cancelAuthDialog"]) {
        document.getElementById(buttonId).addEventListener("click", () => dialog.close());
    }
    dialog.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            event.preventDefault();
            dialog.close();
        }
    });
    dialog.addEventListener("close", () => {
        password.value = "";
        resolveLogin?.(dialog.returnValue === "authenticated");
        resolveLogin = undefined;
    });
    form.addEventListener("submit", async event => {
        event.preventDefault();
        submit.disabled = true;
        errorMessage.textContent = "";
        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: form.elements.username.value, password: password.value }),
                signal: AbortSignal.timeout(15000),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Could not sign in");
            if (dialog.open) dialog.close("authenticated");
        } catch (error) {
            errorMessage.textContent = error.name === "TimeoutError" ? "Sign-in timed out. Try again." : error.message;
        } finally {
            submit.disabled = false;
        }
    });

    async function authenticate() {
        try {
            const response = await fetch("/api/session", { cache: "no-store", signal: AbortSignal.timeout(10000) });
            if (response.ok && (await response.json()).authenticated) return true;
        } catch {}
        form.reset();
        errorMessage.textContent = "";
        dialog.returnValue = "";
        dialog.showModal();
        return new Promise(resolve => { resolveLogin = resolve; });
    }

    return {
        async authenticate() {
            checking ??= authenticate();
            try {
                return await checking;
            } finally {
                checking = undefined;
            }
        },
        async logout() {
            const response = await fetch("/api/logout", { method: "POST", signal: AbortSignal.timeout(10000) });
            if (!response.ok) throw new Error("Could not sign out. Try again.");
        },
    };
}