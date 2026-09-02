import { scopeHeaders } from "@/lib/api/browser-client";

/**
 * Adds the active workspace to an API url that will be opened as a NAVIGATION
 * rather than fetched.
 *
 * The workspace an operator has selected travels as the `X-Workspace-ID` header,
 * which `apiClient` attaches to every request. A `window.open` — the usual way
 * to let the browser handle a file download and its Content-Disposition — sends
 * no custom headers at all. So those requests arrived at the API with no
 * workspace, and the resolver fell through to the user's DEFAULT workspace.
 *
 * The result was quiet and wrong: an operator viewing workspace B pressed
 * Export and downloaded workspace A's data, with nothing on screen suggesting
 * it. Membership is still enforced — you only ever receive a workspace you
 * belong to — so this was never cross-tenant. It was worse in one respect
 * though: plausible data, from the wrong place, with no error to notice.
 *
 * The API resolves `?workspace_id=` when the header is absent, precisely for
 * this case, so the fix is to say out loud what the header would have said. The
 * id is not a secret — it is already in a browser-readable cookie, and every
 * per-route permission check still runs against the resolved workspace.
 */
export function withWorkspaceScope(url: string): string {
    const workspaceId = scopeHeaders()["X-Workspace-ID"];
    if (!workspaceId) return url;

    // Never overwrite an explicit id. A caller that already scoped the url —
    // an admin exporting a workspace they are not currently "in", say — means
    // it, and silently replacing that with the cookie would reintroduce the
    // same class of bug from the other direction.
    const separator = url.includes("?") ? "&" : "?";
    if (/[?&]workspace_id=/.test(url)) return url;

    return `${url}${separator}workspace_id=${encodeURIComponent(workspaceId)}`;
}

/**
 * Open an API url in a new tab with the active workspace attached.
 *
 * Use this for every download that relies on the browser (file dialogs,
 * Content-Disposition, binary formats like xlsx) instead of fetching into a
 * blob. Anything that goes through `apiClient` or `fetch(..., { headers:
 * scopeHeaders() })` already carries the workspace and must not use this.
 */
export function openScoped(url: string): void {
    window.open(withWorkspaceScope(url), "_blank");
}
