import { orderLinks } from "./link-data.js";

const COPY_DISTANCE = 84;

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
    const copyAction = document.createElement("div");
    copyAction.className = "shortlink-copy-action";
    copyAction.setAttribute("role", "status");
    copyAction.setAttribute("aria-live", "polite");
    const copyIcon = document.createElement("i");
    copyIcon.className = "fa-solid fa-copy";
    copyIcon.setAttribute("aria-hidden", "true");
    const copyLabel = document.createElement("span");
    copyLabel.className = "shortlink-copy-label";
    copyLabel.textContent = "Copy";
    copyAction.append(copyIcon, copyLabel);
    copyAction.setAttribute("aria-hidden", "true");
    box.append(anchor, copyAction, handle);
    row.append(box, iconButton(`Delete ${link.title}`, "delete-link", "fa-solid fa-trash-can"));
    return row;
}

export function createLinkList(container, addButton, onChange = () => {}, onEdit = () => {}) {
    let editing = false;
    const copyToast = document.getElementById("copyToast");
    const records = new Map();
    let activeSwipe = null;
    let activeWheel = null;
    let wheelTimer;
    let toastTimer;
    let suppressClickUntil = 0;

    function clearRowSwipe(row) {
        row.classList.remove("swiping", "copy-confirmed");
        row.style.removeProperty("--swipe-reveal");
    }

    function revealCopy(row, distance) {
        if (distance <= 0) {
            clearRowSwipe(row);
            return;
        }
        row.classList.add("swiping");
        row.style.setProperty("--swipe-reveal", `${Math.min(distance, COPY_DISTANCE)}px`);
    }

    async function finishCopyGesture(row, key, shouldCopy) {
        clearRowSwipe(row);
        if (shouldCopy) await copyShortlink(key);
    }

    function cancelSwipe() {
        if (activeSwipe) clearRowSwipe(activeSwipe.row);
        activeSwipe = null;
    }

    function cancelWheelSwipe() {
        clearTimeout(wheelTimer);
        if (activeWheel) clearRowSwipe(activeWheel.row);
        activeWheel = null;
    }

    function copyWithLegacyCommand(text) {
        const previousFocus = document.activeElement;
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.readOnly = true;
        textarea.setAttribute("aria-hidden", "true");
        textarea.style.position = "fixed";
        textarea.style.top = "0";
        textarea.style.left = "0";
        textarea.style.width = "1px";
        textarea.style.height = "1px";
        textarea.style.padding = "0";
        textarea.style.border = "0";
        textarea.style.fontSize = "16px";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        try {
            textarea.focus({ preventScroll: true });
            textarea.select();
            textarea.setSelectionRange(0, text.length);
            if (document.execCommand("copy")) return true;
        } catch {
            return false;
        } finally {
            textarea.remove();
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
                previousFocus.focus({ preventScroll: true });
            }
        }
        return false;
    }

    async function copyText(text) {
        if (!isSecureContext) throw new Error("HTTPS required");
        const legacyCopied = copyWithLegacyCommand(text);
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return;
            } catch (error) {
                if (legacyCopied) return;
                throw error;
            }
        }
        if (!legacyCopied) throw new Error("Clipboard unavailable");
    }

    function showCopyToast(copied, error) {
        clearTimeout(toastTimer);
        updateCopyToastPosition();
        copyToast.dataset.state = copied ? "success" : "error";
        copyToast.textContent = copied
            ? "Copied"
            : !isSecureContext
                ? "Copy failed: HTTPS required"
                : error?.name === "NotAllowedError"
                    ? "Copy failed: browser blocked clipboard access"
                : "Copy failed";
        copyToast.hidden = false;
        toastTimer = setTimeout(() => {
            copyToast.hidden = true;
        }, 1600);
    }

    function updateCopyToastPosition() {
        const viewport = window.visualViewport;
        if (!viewport) return;
        const visibleBottom = window.scrollY + viewport.offsetTop + viewport.height;
        const bodyBottom = document.body.getBoundingClientRect().bottom + window.scrollY;
        const bottomGap = Math.max(0, bodyBottom - visibleBottom);
        copyToast.style.setProperty("--visible-bottom-gap", `${bottomGap}px`);
    }

    window.visualViewport?.addEventListener("resize", updateCopyToastPosition);
    window.visualViewport?.addEventListener("scroll", updateCopyToastPosition);
    window.addEventListener("resize", updateCopyToastPosition);

    async function copyShortlink(key) {
        const text = new URL(`/${key}`, location.origin).href;
        let copied = false;
        let error;
        try {
            await copyText(text);
            copied = true;
        } catch (copyError) {
            error = copyError;
            copied = false;
        }
        showCopyToast(copied, error);
    }

    container.addEventListener("pointerdown", event => {
        if (editing || !["touch", "pen"].includes(event.pointerType)) return;
        const destination = event.target.closest(".link-destination");
        if (!destination) return;
        cancelSwipe();
        cancelWheelSwipe();
        const row = destination.closest(".link-row");
        activeSwipe = {
            pointerId: event.pointerId,
            row,
            key: row.dataset.id,
            startX: event.clientX,
            startY: event.clientY,
            deltaX: 0,
            moved: false,
        };
    });

    document.addEventListener("pointermove", event => {
        if (!activeSwipe || event.pointerId !== activeSwipe.pointerId) return;
        const deltaX = event.clientX - activeSwipe.startX;
        const deltaY = event.clientY - activeSwipe.startY;
        if (Math.abs(deltaY) > 12 && Math.abs(deltaY) > Math.abs(deltaX)) {
            cancelSwipe();
            return;
        }
        if (Math.abs(deltaX) < Math.abs(deltaY)) return;
        activeSwipe.deltaX = deltaX;
        activeSwipe.moved ||= Math.abs(deltaX) >= 12;
        if (deltaX >= 0) {
            clearRowSwipe(activeSwipe.row);
            return;
        }
        revealCopy(activeSwipe.row, -deltaX);
    });

    document.addEventListener("pointerup", async event => {
        if (!activeSwipe || event.pointerId !== activeSwipe.pointerId) return;
        const swipe = activeSwipe;
        activeSwipe = null;
        if (swipe.moved) suppressClickUntil = Date.now() + 700;
        await finishCopyGesture(swipe.row, swipe.key, swipe.deltaX <= -COPY_DISTANCE);
    });

    document.addEventListener("pointercancel", event => {
        if (activeSwipe?.pointerId === event.pointerId) cancelSwipe();
    });

    container.addEventListener("wheel", event => {
        if (editing) return;
        const destination = event.target.closest(".link-destination");
        const scrollLeft = event.deltaX || (event.shiftKey ? -event.deltaY : 0);
        if (!destination || !scrollLeft || (!event.shiftKey && Math.abs(scrollLeft) < Math.abs(event.deltaY))) return;
        const row = destination.closest(".link-row");
        if (!activeWheel || activeWheel.row !== row) {
            cancelWheelSwipe();
            if (scrollLeft < 0) return;
            activeWheel = { row, key: row.dataset.id, distance: 0, copied: false };
        }
        event.preventDefault();
        if (activeWheel.copied) {
            clearTimeout(wheelTimer);
            wheelTimer = setTimeout(() => { activeWheel = null; }, 180);
            return;
        }
        activeWheel.distance = Math.max(0, Math.min(COPY_DISTANCE, activeWheel.distance + scrollLeft));
        revealCopy(row, activeWheel.distance);
        if (activeWheel.distance >= COPY_DISTANCE) {
            activeWheel.copied = true;
            clearRowSwipe(row);
            void copyShortlink(activeWheel.key);
        }
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => {
            if (activeWheel) clearRowSwipe(activeWheel.row);
            activeWheel = null;
        }, 180);
    }, { passive: false });

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
        const destination = event.target.closest(".link-destination");
        if (!editing) {
            if (destination && Date.now() < suppressClickUntil) {
                event.preventDefault();
                event.stopPropagation();
                suppressClickUntil = 0;
            }
            return;
        }
        if (destination) {
            event.preventDefault();
            const row = destination.closest(".link-row");
            onEdit(row.dataset.id, records.get(row.dataset.id));
            return;
        }
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
        getKeys: () => [...records.keys()],
        enableEditing() {
            editing = true;
            container.classList.add("reordering");
            sortable.option("disabled", false);
        },
        disableEditing() {
            cancelSwipe();
            cancelWheelSwipe();
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
            const key = link.key;
            if (records.has(key)) return false;
            const row = createRow(key, link);
            records.set(key, { title: link.title, url: link.url, icon: link.icon });
            container.prepend(row);
            commit();
            row.querySelector(".reorder-handle").focus();
            return true;
        },
        update(previousKey, link) {
            if (!editing) return;
            const key = link.key;
            if (key !== previousKey && records.has(key)) return false;
            const row = [...container.children].find(candidate => candidate.dataset.id === previousKey);
            if (!row) return false;

            records.delete(previousKey);
            records.set(key, { title: link.title, url: link.url, icon: link.icon });
            row.dataset.id = key;
            const destination = row.querySelector(".link-destination");
            destination.href = link.url;
            const icon = destination.querySelector("i");
            icon.className = link.icon;
            destination.replaceChildren(icon, document.createTextNode(` ${link.title}`));
            const reorderHandle = row.querySelector(".reorder-handle");
            reorderHandle.title = `Reorder ${link.title}`;
            reorderHandle.setAttribute("aria-label", `Reorder ${link.title}`);
            const deleteButton = row.querySelector(".delete-link");
            deleteButton.title = `Delete ${link.title}`;
            deleteButton.setAttribute("aria-label", `Delete ${link.title}`);
            commit();
            return true;
        },
    };
}