export function readProfile(value) {
  if (value == null) return {};
  if (typeof value.handle !== "string" || !value.handle.trim() || value.handle.length > 120) {
    throw new Error("Invalid profile handle");
  }
  if (typeof value.imagePath !== "string" || !value.imagePath.startsWith("/") ||
      value.imagePath.startsWith("//") || /[\\\s?#]/.test(value.imagePath) || value.imagePath.length > 2048) {
    throw new Error("Invalid profile image path");
  }
  return { handle: value.handle.trim(), imagePath: value.imagePath };
}