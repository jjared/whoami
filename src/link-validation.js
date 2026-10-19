export const MAX_LINK_BYTES = 64 * 1024;

export function validateLinks(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > 200) return null;
  const links = [];
  for (const [key, link] of entries) {
    if (!/^[a-z0-9][a-z0-9_-]{0,127}$/i.test(key) || ["constructor", "prototype"].includes(key)) return null;
    if (!link || typeof link !== "object" || Array.isArray(link)) return null;
    if (typeof link.title !== "string" || !link.title.trim() || link.title.length > 120) return null;
    if (typeof link.url !== "string" || link.url.length > 2048) return null;
    if (typeof link.icon !== "string" || !/^(fa-solid|fa-regular|fa-brands|fas|far|fab) fa-[a-z0-9-]+$/.test(link.icon)) return null;
    if (!Number.isSafeInteger(link.order) || link.order < 0) return null;
    let destination;
    try {
      destination = new URL(link.url);
    } catch {
      return null;
    }
    if (!["http:", "https:"].includes(destination.protocol)) return null;
    links.push([key, { title: link.title.trim(), url: destination.href, icon: link.icon, order: link.order }]);
  }
  return Object.fromEntries(links);
}