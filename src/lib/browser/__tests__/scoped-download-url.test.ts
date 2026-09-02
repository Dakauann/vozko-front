import { afterEach, describe, expect, it, vi } from "vitest";

import { withWorkspaceScope } from "@/lib/browser/scoped-download-url";

vi.mock("@/lib/api/browser-client", () => ({
    scopeHeaders: () => mockHeaders,
}));

let mockHeaders: Record<string, string> = {};

afterEach(() => {
    mockHeaders = {};
});

describe("withWorkspaceScope", () => {
    // THE regression. A navigation cannot send X-Workspace-ID, so without this
    // the API fell back to the user's default workspace and the operator
    // downloaded a different workspace's data than the one on screen.
    it("attaches the active workspace", () => {
        mockHeaders = { "X-Workspace-ID": "ws-b" };
        expect(withWorkspaceScope("https://api.test/user/balance/export")).toBe(
            "https://api.test/user/balance/export?workspace_id=ws-b",
        );
    });

    it("appends to a url that already has a query string", () => {
        mockHeaders = { "X-Workspace-ID": "ws-b" };
        expect(withWorkspaceScope("https://api.test/export?format=csv")).toBe(
            "https://api.test/export?format=csv&workspace_id=ws-b",
        );
    });

    it("encodes the id", () => {
        mockHeaders = { "X-Workspace-ID": "ws b/c" };
        expect(withWorkspaceScope("https://api.test/export")).toBe(
            "https://api.test/export?workspace_id=ws%20b%2Fc",
        );
    });

    // No cookie means no selection to express. Sending workspace_id= empty
    // would be worse than sending nothing: the API would read a present-but-
    // blank id rather than falling back to its own resolution.
    it("leaves the url alone when no workspace is selected", () => {
        mockHeaders = {};
        expect(withWorkspaceScope("https://api.test/export")).toBe(
            "https://api.test/export",
        );
    });

    // An explicit id is a deliberate choice — an admin exporting a workspace
    // they are not currently "in". Overwriting it with the cookie would
    // reintroduce the same bug from the other direction.
    it("never overwrites an id the caller already set", () => {
        mockHeaders = { "X-Workspace-ID": "ws-cookie" };
        expect(
            withWorkspaceScope("https://api.test/export?workspace_id=ws-explicit"),
        ).toBe("https://api.test/export?workspace_id=ws-explicit");
        expect(
            withWorkspaceScope("https://api.test/export?a=1&workspace_id=ws-x&b=2"),
        ).toBe("https://api.test/export?a=1&workspace_id=ws-x&b=2");
    });

    // A param that merely ends in workspace_id must not be mistaken for it, or
    // the real scope would be dropped and we are back to the default workspace.
    it("does not treat a lookalike param as the workspace id", () => {
        mockHeaders = { "X-Workspace-ID": "ws-b" };
        expect(withWorkspaceScope("https://api.test/export?my_workspace_id=x")).toBe(
            "https://api.test/export?my_workspace_id=x&workspace_id=ws-b",
        );
    });
});
