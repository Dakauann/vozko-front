/**
 * What to render when a message key is missing.
 *
 * A dotted key path in the UI is the worst possible outcome: it is unreadable,
 * it leaks internal structure to a customer, and it looks like the page is
 * broken rather than a string being absent. Humanising the last segment turns
 * `whatsappCampaignsPage.table.avoidingSpam` into "Avoiding spam" — still not
 * the translation, but a plausible label that does not shout.
 *
 * This lives on its own because the server request config and the client
 * provider both need it, and for a long time only the SERVER had it. Client
 * components are most of this app, so in practice the protection was absent
 * exactly where it mattered.
 */
export function humanizeMessageKey(key: string): string {
    const last = key.split(".").pop() ?? key;
    const spaced = last.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Missing or invalid messages must never crash a page; noisy only outside prod. */
export function reportMessageError(error: unknown): void {
    if (process.env.NODE_ENV !== "production") {
        console.error(error);
    }
}
