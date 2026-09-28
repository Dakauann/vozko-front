import { describe, expect, it } from "vitest";

import { connectResultFromMessage, connectResultFromQuery, isConnectedOutcome } from "@/lib/facebook/connect";

describe("connectResultFromMessage", () => {
    it("reads the per-Page outcomes of a popup message", () => {
        expect(
            connectResultFromMessage({
                source: "fb-business-login",
                status: "partial",
                pages: [
                    { id: "uuid-1", fbPageId: "1", name: "Loja", outcome: "connected", missing: [] },
                    { fbPageId: "2", name: "Outra", outcome: "missing_task", missing: ["MESSAGING"] },
                ],
            }),
        ).toEqual({
            status: "partial",
            reason: undefined,
            pages: [
                { id: "uuid-1", fbPageId: "1", name: "Loja", outcome: "connected", missing: [], warning: undefined },
                { id: undefined, fbPageId: "2", name: "Outra", outcome: "missing_task", missing: ["MESSAGING"], warning: undefined },
            ],
        });
    });

    it("carries the error reason", () => {
        expect(connectResultFromMessage({ source: "fb-business-login", status: "error", reason: "expired_state" })).toEqual({
            status: "error",
            reason: "expired_state",
            pages: [],
        });
    });

    it("ignores a message without a known status", () => {
        expect(connectResultFromMessage({ source: "fb-business-login" })).toBeNull();
        expect(connectResultFromMessage({ source: "fb-business-login", status: "weird" })).toBeNull();
    });

    it("drops malformed page entries instead of inventing them", () => {
        expect(
            connectResultFromMessage({ source: "fb-business-login", status: "connected", pages: [null, { name: "x" }, "y"] })?.pages,
        ).toEqual([]);
    });
});

describe("connectResultFromQuery", () => {
    it("reads the redirect fallback", () => {
        expect(connectResultFromQuery(new URLSearchParams("facebook=partial&connected=2&skipped=1"))).toEqual({
            status: "partial",
            connected: 2,
            skipped: 1,
            reason: undefined,
        });
    });

    it("returns null when the query is not a Facebook result", () => {
        expect(connectResultFromQuery(new URLSearchParams("instagram=connected"))).toBeNull();
        expect(connectResultFromQuery(new URLSearchParams("facebook=bogus"))).toBeNull();
    });

    it("keeps the error reason", () => {
        expect(connectResultFromQuery(new URLSearchParams("facebook=error&reason=no_pages_granted"))).toMatchObject({
            status: "error",
            reason: "no_pages_granted",
        });
    });
});

describe("isConnectedOutcome", () => {
    it("counts only connected and reconnected pages as connected", () => {
        expect(isConnectedOutcome("connected")).toBe(true);
        expect(isConnectedOutcome("reconnected")).toBe(true);
        expect(isConnectedOutcome("already_linked_elsewhere")).toBe(false);
        expect(isConnectedOutcome("missing_task")).toBe(false);
        expect(isConnectedOutcome("missing_permission")).toBe(false);
    });
});
