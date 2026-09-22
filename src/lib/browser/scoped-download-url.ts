import { scopeHeaders } from "@/lib/api/browser-client";

export function withWorkspaceScope(url: string): string {
    const workspaceId = scopeHeaders()["X-Workspace-ID"];
    if (!workspaceId) return url;

    const separator = url.includes("?") ? "&" : "?";
    if (/[?&]workspace_id=/.test(url)) return url;

    return `${url}${separator}workspace_id=${encodeURIComponent(workspaceId)}`;
}

export function openScoped(url: string): void {
    window.open(withWorkspaceScope(url), "_blank");
}
