const SAVE_INTERVAL = 1100;

async function writeLinks(body) {
    const response = await fetch("/api/links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
        const error = new Error(`Could not save links: ${response.status}`);
        error.status = response.status;
        throw error;
    }
}

export function createLinkSaver(onStatus, write = writeLinks) {
    let pending = null;
    let inFlight = false;
    let failed = false;
    let timer;

    async function flush() {
        timer = undefined;
        if (pending === null || failed) return;
        const body = pending;
        pending = null;
        inFlight = true;
        try {
            await write(body);
            onStatus(pending === null ? "saved" : "saving");
        } catch (error) {
            pending ??= body;
            failed = true;
            onStatus("error", error);
        } finally {
            inFlight = false;
            timer = setTimeout(flush, SAVE_INTERVAL);
        }
    }

    function schedule() {
        failed = false;
        onStatus("saving");
        if (!timer && !inFlight) timer = setTimeout(flush, SAVE_INTERVAL);
    }

    return {
        queue(links) {
            pending = JSON.stringify(links);
            schedule();
        },
        retry() {
            if (pending !== null) schedule();
        },
        hasUnsavedChanges: () => pending !== null || inFlight,
    };
}