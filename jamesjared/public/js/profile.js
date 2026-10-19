export async function loadProfile() {
    try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not load profile: ${response.status}`);
        const profile = await response.json();
        if (!profile.handle || !profile.imagePath) return;

        document.getElementById("userName").textContent = profile.handle;
        document.title = `${profile.handle} | whoami`;
        for (const image of document.querySelectorAll("[data-profile-image]")) {
            image.src = profile.imagePath;
            image.alt = `${profile.handle} profile picture`;
            image.hidden = false;
        }
        for (const link of document.querySelectorAll("[data-profile-image-link]")) {
            link.href = profile.imagePath;
        }
    } catch (error) {
        console.error("Could not load site profile", error);
    }
}