import { createLinkId, orderLinks } from "./link-data.js";

function iconButton(label, className, icon) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.title = label;
    button.setAttribute("aria-label", label);
    const symbol = document.createElement("i");
    symbol.className = icon;
    symbol.setAttribute("aria-hidden", "true");
    button.append(symbol);
    return button;
}

function createRow(key, link, popout = "") {
    const row = document.createElement("div");
    row.className = "link-row";
    row.dataset.id = key;
    const box = document.createElement("div");
    box.className = key === popout ? "link popout" : "link";
    const anchor = document.createElement("a");
    anchor.className = "link-destination";
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    const icon = document.createElement("i");
    icon.className = link.icon;
    icon.setAttribute("aria-hidden", "true");
    anchor.append(icon, document.createTextNode(` ${link.title}`));
    const handle = iconButton(`Reorder ${link.title}`, "reorder-handle", "fa-solid fa-grip-vertical");
    handle.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown Home End");
    box.append(anchor, handle);
    row.append(box, iconButton(`Delete ${link.title}`, "delete-link", "fa-solid fa-trash-can"));
    return row;
}

export function createLinkList(container, addButton, onChange = () => {}) {
    let editing = false;
    const records = new Map();

    function updateOrder() {
        for (const [index, row] of [...container.children].entries()) {
            row.dataset.order = String((index + 1) * 10);
        }
    }

    function commit() {
        updateOrder();
        onChange(Object.fromEntries(
            [...container.children].filter(row => !row.classList.contains("sortable-fallback"))
                .map(row => [row.dataset.id, { ...records.get(row.dataset.id), order: Number(row.dataset.order) }]),
        ));
    }

    const sortable = new Sortable(container, {
        disabled: true,
        draggable: ".link-row",
        handle: ".reorder-handle",
        animation: 150,
        forceFallback: true,
        fallbackTolerance: 4,
        ghostClass: "reorder-ghost",
        chosenClass: "reorder-chosen",
        onEnd: event => {
            if (event.oldIndex !== event.newIndex) commit();
        },
    });

    container.addEventListener("click", event => {
        if (!editing) return;
        if (event.target.closest(".link-destination")) event.preventDefault();
        const remove = event.target.closest(".delete-link");
        if (!remove) return;
        const row = remove.closest(".link-row");
        const next = row.nextElementSibling ?? row.previousElementSibling;
        records.delete(row.dataset.id);
        row.remove();
        commit();
        (next?.querySelector(".delete-link") ?? addButton).focus();
    });

    container.addEventListener("keydown", event => {
        const handle = event.target.closest(".reorder-handle");
        if (!editing || !handle) return;
        const row = handle.closest(".link-row");
        const previousIndex = [...container.children].indexOf(row);
        if (event.key === "ArrowUp") {
            row.previousElementSibling?.before(row);
        } else if (event.key === "ArrowDown") {
            row.nextElementSibling?.after(row);
        } else if (event.key === "Home") {
            container.prepend(row);
        } else if (event.key === "End") {
            container.append(row);
        } else {
            return;
        }
        event.preventDefault();
        if ([...container.children].indexOf(row) !== previousIndex) commit();
        handle.focus();
    });

    return {
        isEditing: () => editing,
        enableEditing() {
            editing = true;
            container.classList.add("reordering");
            sortable.option("disabled", false);
        },
        disableEditing() {
            editing = false;
            container.classList.remove("reordering");
            sortable.option("disabled", true);
        },
        render(links, popout) {
            const fragment = document.createDocumentFragment();
            records.clear();
            let redirect = "";
            for (const [key, link] of orderLinks(links)) {
                const destination = new URL(link.url);
                if (!["https:", "http:"].includes(destination.protocol)) continue;
                records.set(key, { title: link.title, url: destination.href, icon: link.icon });
                fragment.append(createRow(key, link, popout));
                if (key === popout) redirect = destination.href;
            }
            container.replaceChildren(fragment);
            updateOrder();
            return redirect;
        },
        add(link) {
            if (!editing) return;
            const key = createLinkId(link.title, [...container.children].map(row => row.dataset.id));
            const row = createRow(key, link);
            records.set(key, { ...link });
            container.prepend(row);
            commit();
            row.querySelector(".reorder-handle").focus();
        },
    };
}