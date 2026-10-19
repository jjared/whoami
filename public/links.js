import { createLinkDialog } from "./js/link-dialog.js";
import { createLinkList } from "./js/link-list.js";
import { createLinkSaver } from "./js/link-saver.js";
import { createAuthDialog } from "./js/auth-dialog.js";

const container = document.getElementById("links");
const profilePicture = document.getElementById("profilePicture");
const addLink = document.getElementById("addLink");
const saveStatus = document.getElementById("saveStatus");
const saveMessage = document.getElementById("saveMessage");
const retrySave = document.getElementById("retrySave");
const auth = createAuthDialog();
const saver = createLinkSaver((state, error) => {
    saveStatus.dataset.state = state;
    saveStatus.title = error?.message ?? "";
    saveMessage.textContent = { saving: "Saving...", saved: "Saved", error: "Could not save changes." }[state];
    retrySave.hidden = state !== "error";
    if (error?.status === 401) {
        list.disableEditing();
        addLink.hidden = true;
        profilePicture.setAttribute("aria-pressed", "false");
        saveMessage.textContent = "Session expired. Sign in to save.";
    }
});
const list = createLinkList(container, addLink, links => saver.queue(links));
const dialog = createLinkDialog(link => list.add(link));
let profileClicks = 0;
let redirectTimeout;
let loaded = false;
let authBusy = false;

addLink.addEventListener("click", () => dialog.open());
retrySave.addEventListener("click", async () => {
    if (await enableEditing()) saver.retry();
});
async function signOut() {
    if (saver.hasUnsavedChanges()) return;
    try {
        await auth.logout();
        list.disableEditing();
        profilePicture.setAttribute("aria-pressed", "false");
        addLink.hidden = true;
        saveStatus.hidden = true;
        profileClicks = 0;
    } catch (error) {
        saveMessage.textContent = error.message;
    }
}
window.addEventListener("beforeunload", event => {
    if (saver.hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = "";
    }
});

async function enableEditing() {
    if (!await auth.authenticate()) return false;
    profilePicture.setAttribute("aria-pressed", "true");
    addLink.hidden = false;
    saveStatus.hidden = false;
    list.enableEditing();
    return true;
}

profilePicture.addEventListener("click", async () => {
    if (!loaded || authBusy || ++profileClicks < 5) {
        return;
    }

    clearTimeout(redirectTimeout);
    profileClicks = 0;
    authBusy = true;
    try {
        if (list.isEditing()) {
            await signOut();
        } else if (await enableEditing() && saver.hasUnsavedChanges()) {
            saver.retry();
        }
    } finally {
        authBusy = false;
    }
});

async function loadLinks() {
    container.textContent = "Loading links...";

    try {
        const response = await fetch("/api/links", { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Could not load links: ${response.status}`);
        }

        const links = await response.json();
        const redirect = list.render(links, location.pathname.split("/")[1]);
        loaded = true;
        if (redirect && !list.isEditing()) {
            redirectTimeout = setTimeout(() => window.location.replace(redirect), 1500);
        }
    } catch (error) {
        console.error(error);
        container.textContent = "Links are temporarily unavailable. Please try again later.";
    }
}

loadLinks();
