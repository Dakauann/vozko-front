import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchWithRefresh = vi.fn();

vi.mock("@/lib/api/browser-client", () => ({
    apiClient: vi.fn(),
    getApiBaseUrl: () => "https://api.test",
    scopeHeaders: () => ({ "X-Workspace-ID": "ws-1" }),
    fetchWithRefresh: (run: () => Promise<Response>) => fetchWithRefresh(run),
}));

import {
    exportWhatsAppCampaignEntriesAction,
    exportWhatsAppWorkspaceEntriesAction,
} from "@/app/actions/whatsapp-campaigns";

function queuedResponse(id = "job-1") {
    return new Response(
        JSON.stringify({ id, kind: "conversation_entries", format: "csv", status: "queued" }),
        { status: 202, headers: { "Content-Type": "application/json" } },
    );
}

function errorResponse(status: number, message?: string) {
    return new Response(JSON.stringify({ message }), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

let requestedUrl = "";

beforeEach(() => {
    requestedUrl = "";
    fetchWithRefresh.mockReset();
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
            requestedUrl = url;
            return queuedResponse();
        }),
    );
    fetchWithRefresh.mockImplementation((run: () => Promise<Response>) => run());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("workspace lead export", () => {
    it("repeats the status parameter once per selected status", async () => {
        await exportWhatsAppWorkspaceEntriesAction({
            statuses: ["SENT", "DELIVERED", "READ"],
        });

        const query = new URL(requestedUrl).searchParams;
        expect(query.getAll("status")).toEqual(["SENT", "DELIVERED", "READ"]);
    });

    it("carries the same recorte the summary tiles use", async () => {
        await exportWhatsAppWorkspaceEntriesAction({
            statuses: ["READ"],
            type: "standard",
            from: "2026-07-01",
            to: "2026-07-31",
        });

        const url = new URL(requestedUrl);
        expect(url.pathname).toBe("/whatsapp/campaigns/entries/export");
        expect(url.searchParams.get("type")).toBe("standard");
        expect(url.searchParams.get("from")).toBe("2026-07-01");
        expect(url.searchParams.get("to")).toBe("2026-07-31");
    });

    it("omits the status filter entirely when none is given", async () => {
        await exportWhatsAppWorkspaceEntriesAction({});

        const url = new URL(requestedUrl);
        expect(url.searchParams.getAll("status")).toEqual([]);
        expect(url.search).toBe("");
    });

    it("drops empty values instead of sending blank parameters", async () => {
        await exportWhatsAppWorkspaceEntriesAction({
            statuses: ["READ"],
            from: "",
            to: undefined,
        });

        const url = new URL(requestedUrl);
        expect(url.searchParams.has("from")).toBe(false);
        expect(url.searchParams.has("to")).toBe(false);
    });
});

describe("export failures", () => {
    it.each([
        [413, "tooLarge"],
        [503, "unavailable"],
    ])("maps %i to %s", async (status, expected) => {
        vi.stubGlobal("fetch", vi.fn(async () => errorResponse(status)));

        const result = await exportWhatsAppWorkspaceEntriesAction({});

        expect(result.job).toBeNull();
        expect(result.error).toBe(expected);
    });

    it("passes an unexpected failure's message through", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => errorResponse(500, "database is on fire")));

        const result = await exportWhatsAppWorkspaceEntriesAction({});

        expect(result.error).toBe("database is on fire");
    });
});

describe("queued job", () => {
    it("returns the job the server queued instead of a file", async () => {
        const result = await exportWhatsAppWorkspaceEntriesAction({});

        expect(result.error).toBeNull();
        expect(result.job?.id).toBe("job-1");
        expect(result.job?.status).toBe("queued");
    });

    it("treats a success with no job id as a failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("{}", { status: 202, headers: { "Content-Type": "application/json" } })),
        );

        const result = await exportWhatsAppWorkspaceEntriesAction({});

        expect(result.job).toBeNull();
        expect(result.error).toBe("Failed to export");
    });
});

describe("per-campaign export", () => {
    it("still targets the campaign path", async () => {
        await exportWhatsAppCampaignEntriesAction("camp-1", { status: ["READ"] });

        const url = new URL(requestedUrl);
        expect(url.pathname).toBe("/whatsapp/campaigns/camp-1/entries/export");
        expect(url.searchParams.getAll("status")).toEqual(["READ"]);
    });
});
