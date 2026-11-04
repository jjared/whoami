import { createIconPicker } from "./icon-picker.js";
import { createLinkId } from "./link-data.js";

export function createLinkDialog(onAdd, getExistingKeys = () => []) {
    const dialog = document.getElementById("linkDialog");
    const form = document.getElementById("linkForm");
    const dialogTitle = document.getElementById("linkDialogTitle");
    const submitLabel = document.getElementById("linkSubmitLabel");
    const titleInput = document.getElementById("linkTitle");
    const keyInput = document.getElementById("linkKey");
    const urlInput = document.getElementById("linkUrl");
    let keyManuallyEdited = false;
    let editingKey = null;
    const picker = createIconPicker(
        document.getElementById("iconSearch"),
        document.getElementById("iconOptions"),
        document.getElementById("noIcons"),
    );

    for (const buttonId of ["closeLinkDialog", "cancelLinkDialog"]) {
        document.getElementById(buttonId).addEventListener("click", () => dialog.close());
    }
    dialog.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            event.preventDefault();
            dialog.close();
        }
    });
    titleInput.addEventListener("input", () => {
        titleInput.setCustomValidity("");
        if (!keyManuallyEdited) keyInput.value = createLinkId(titleInput.value, getExistingKeys());
    });
    keyInput.addEventListener("input", () => {
        keyManuallyEdited = true;
        keyInput.setCustomValidity("");
    });
    urlInput.addEventListener("input", () => urlInput.setCustomValidity(""));

    form.addEventListener("submit", event => {
        event.preventDefault();
        const title = titleInput.value.trim();
        if (!title) {
            titleInput.setCustomValidity("Enter a title.");
            titleInput.reportValidity();
            return;
        }
        const key = keyInput.value.trim();
        if (!/^[a-z0-9][a-z0-9_-]{0,127}$/i.test(key) || ["constructor", "prototype"].includes(key)) {
            keyInput.setCustomValidity("Use a key starting with a letter or number, followed by letters, numbers, hyphens, or underscores.");
            keyInput.reportValidity();
            return;
        }
        if (getExistingKeys().some(existingKey => existingKey !== editingKey && existingKey === key)) {
            keyInput.setCustomValidity("That shortlink key is already in use.");
            keyInput.reportValidity();
            return;
        }
        const destination = new URL(urlInput.value.trim());
        if (!["http:", "https:"].includes(destination.protocol)) {
            urlInput.setCustomValidity("Enter an HTTP or HTTPS URL.");
            urlInput.reportValidity();
            return;
        }
        const link = {
            key,
            title,
            url: destination.href,
            icon: new FormData(form).get("icon"),
        };
        if (onAdd(link, editingKey) === false) {
            keyInput.setCustomValidity("That shortlink key is already in use.");
            keyInput.reportValidity();
            return;
        }
        dialog.close();
    });

    return {
        open(link = null, key = null) {
            form.reset();
            editingKey = link ? key : null;
            keyManuallyEdited = Boolean(link);
            titleInput.setCustomValidity("");
            keyInput.setCustomValidity("");
            urlInput.setCustomValidity("");
            picker.reset();
            dialogTitle.textContent = link ? "Edit link" : "New link";
            submitLabel.textContent = link ? "Save link" : "Add link";
            if (link) {
                titleInput.value = link.title;
                keyInput.value = key;
                urlInput.value = link.url;
                picker.select(link.icon);
            }
            dialog.showModal();
        },
    };
}