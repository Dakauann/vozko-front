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

function csvResponse(body: string, headers: Record<string, string> = {}) {
    return new Response(body, { status: 200, headers });
}

function errorResponse(status: number, message?: string) {
    return new Response(JSON.stringify({ message }), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

/** The URL the action would have called, captured from the fetch it builds. */
let requestedUrl = "";

beforeEach(() => {
    requestedUrl = "";
    fetchWithRefresh.mockReset();
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
            requestedUrl = url;
            return csvResponse("number,name\n5511,Ana\n");
        }),
    );
    fetchWithRefresh.mockImplementation((run: () => Promise<Response>) => run());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("workspace lead export", () => {
    // The card: the leads that were sent, delivered and read, in one pull. The
    // backend reads a multi-status filter as a repeated parameter, so a joined
    // string would silently become one unknown status and be rejected.
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
    // Each of these tells the operator something different to do, so they must
    // not collapse into one generic failure.
    it.each([
        [404, "noEntries"],
        [413, "tooLarge"],
        [429, "busy"],
    ])("maps %i to %s", async (status, expected) => {
        vi.stubGlobal("fetch", vi.fn(async () => errorResponse(status)));

        const result = await exportWhatsAppWorkspaceEntriesAction({});

        expect(result.csvText).toBeNull();
        expect(result.error).toBe(expected);
    });

    it("passes an unexpected failure's message through", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => errorResponse(500, "database is on fire")));

        const result = await exportWhatsAppWorkspaceEntriesAction({});

        expect(result.error).toBe("database is on fire");
    });
});

describe("filename", () => {
    it("uses the name the server chose", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                csvResponse("number\n5511\n", {
                    "Content-Disposition": 'attachment; filename="whatsapp-leads-2026-08-13.csv"',
                }),
            ),
        );

        const result = await exportWhatsAppWorkspaceEntriesAction({});

        expect(result.filename).toBe("whatsapp-leads-2026-08-13.csv");
    });

    it("falls back to a dated name when the server sends no disposition", async () => {
        const result = await exportWhatsAppWorkspaceEntriesAction({});

        expect(result.filename).toMatch(/^whatsapp-campaign-export-\d{4}-\d{2}-\d{2}\.csv$/);
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
