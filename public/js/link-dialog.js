import { createIconPicker } from "./icon-picker.js";

export function createLinkDialog(onAdd) {
    const dialog = document.getElementById("linkDialog");
    const form = document.getElementById("linkForm");
    const titleInput = document.getElementById("linkTitle");
    const urlInput = document.getElementById("linkUrl");
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
    for (const input of [titleInput, urlInput]) {
        input.addEventListener("input", () => input.setCustomValidity(""));
    }

    form.addEventListener("submit", event => {
        event.preventDefault();
        const title = titleInput.value.trim();
        if (!title) {
            titleInput.setCustomValidity("Enter a title.");
            titleInput.reportValidity();
            return;
        }
        const destination = new URL(urlInput.value.trim());
        if (!["http:", "https:"].includes(destination.protocol)) {
            urlInput.setCustomValidity("Enter an HTTP or HTTPS URL.");
            urlInput.reportValidity();
            return;
        }
        const link = {
            title,
            url: destination.href,
            icon: new FormData(form).get("icon"),
        };
        dialog.close();
        onAdd(link);
    });

    return {
        open() {
            form.reset();
            titleInput.setCustomValidity("");
            urlInput.setCustomValidity("");
            picker.reset();
            dialog.showModal();
        },
    };
}