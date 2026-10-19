export function buildProfileHtml(template, variables) {
    const handle = variables.PROFILE_HANDLE?.trim();
    const imagePath = variables.PROFILE_IMAGE_PATH;
    const escape = value => value.replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
    return template.replace(/\{\{PROFILE_(HANDLE|IMAGE_PATH)\}\}/g,
        (placeholder, field) => escape(field === "HANDLE" ? handle : imagePath));
}