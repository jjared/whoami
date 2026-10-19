export function orderLinks(links) {
    return Object.entries(links).sort(
        ([, first], [, second]) =>
            (first.order ?? Number.MAX_SAFE_INTEGER) -
            (second.order ?? Number.MAX_SAFE_INTEGER),
    );
}

export function createLinkId(title, existingIds) {
    const baseId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "link";
    const usedIds = new Set(existingIds);
    let key = baseId;
    let suffix = 2;
    while (usedIds.has(key)) key = `${baseId}-${suffix++}`;
    return key;
}