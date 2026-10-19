export function buildProfileHtml(template, variables) {
    const handle = variables.PROFILE_HANDLE?.trim();
    const imagePath = variables.PROFILE_IMAGE_PATH;
    if (!handle || handle.length > 120) throw new Error("Set PROFILE_HANDLE to 1-120 characters in build variables.");
    if (!imagePath || !imagePath.startsWith("/") || imagePath.startsWith("//") ||
        /[\\\s?#]/.test(imagePath) || imagePath.length > 2048) {
        throw new Error("Set PROFILE_IMAGE_PATH to a root-relative image path in build variables.");
    }
    const escape = value => value.replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
    return template.replace(/\{\{PROFILE_(HANDLE|IMAGE_PATH)\}\}/g,
        (placeholder, field) => escape(field === "HANDLE" ? handle : imagePath));
}