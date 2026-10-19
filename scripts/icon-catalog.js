export function createIconCatalog(metadata) {
    return Object.entries(metadata).flatMap(([name, icon]) =>
        icon.familyStylesByLicense.free
            .filter(({ family }) => family === "classic")
            .map(({ style }) => ({
                label: `${icon.label} (${style})`,
                className: `fa-${style} fa-${name}`,
                search: [name, icon.label, style, ...(icon.search?.terms ?? []), ...(icon.aliases?.names ?? [])]
                    .join(" ").toLowerCase(),
            })),
    ).sort((first, second) => first.label.localeCompare(second.label, "en"));
}