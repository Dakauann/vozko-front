import { describe, expect, it } from "vitest";

import { queueFormErrors, queueFormFrom, queuePayload } from "./form";
import { holdMusicFromKey, holdMusicKey, type CallQueue } from "./types";

const queue: CallQueue = {
    id: "q1",
    name: "Suporte",
    strategy: "round_robin",
    departmentId: "dept-1",
    memberUserIds: [],
    ringSeconds: 20,
    maxWaitSeconds: 120,
    wrapUpSeconds: 5,
    holdMusic: { presetId: "lofi" },
    createdAt: "2026-09-30T00:00:00Z",
    updatedAt: "2026-09-30T00:00:00Z",
};

describe("queue form", () => {
    it("starts a new queue with the industry defaults", () => {
        const form = queueFormFrom(null);
        expect(form.strategy).toBe("longest_idle");
        expect([form.ringSeconds, form.maxWaitSeconds, form.wrapUpSeconds]).toEqual([15, 300, 10]);
        expect(form.holdMusic).toEqual({ presetId: "piano_calmo" });
    });

    it("edits a department queue as a department queue", () => {
        const form = queueFormFrom(queue);
        expect(form.membersFrom).toBe("department");
        expect(queuePayload(form)).toEqual({
            name: "Suporte",
            strategy: "round_robin",
            departmentId: "dept-1",
            ringSeconds: 20,
            maxWaitSeconds: 120,
            wrapUpSeconds: 5,
            holdMusic: { presetId: "lofi" },
        });
    });

    it("sends people, never both people and a department", () => {
        const form = { ...queueFormFrom(queue), membersFrom: "people" as const, memberUserIds: ["u1", "u2", "u1"] };
        const payload = queuePayload(form);
        expect(payload.departmentId).toBeUndefined();
        expect(payload.memberUserIds).toEqual(["u1", "u2"]);
    });

    it("sends either a preset or an upload as hold music", () => {
        const form = { ...queueFormFrom(queue), holdMusic: { presetId: "lofi", mediaId: "m1" } };
        expect(queuePayload(form).holdMusic).toEqual({ mediaId: "m1" });
    });

    it("flags what the server would refuse", () => {
        const form = { ...queueFormFrom(null), name: "  ", ringSeconds: 2, maxWaitSeconds: 4000, wrapUpSeconds: -1 };
        expect(queueFormErrors(form)).toEqual(["name", "members", "ringSeconds", "maxWaitSeconds", "wrapUpSeconds"]);
        expect(queueFormErrors({ ...queueFormFrom(null), name: "Vendas", membersFrom: "department" })).toEqual(["department"]);
        expect(queueFormErrors({ ...queueFormFrom(null), name: "Vendas", memberUserIds: ["u1"] })).toEqual([]);
    });
});

describe("hold music choice", () => {
    it("round-trips presets and uploads through a single select value", () => {
        expect(holdMusicFromKey(holdMusicKey({ presetId: "bossa_nova" }))).toEqual({ presetId: "bossa_nova" });
        expect(holdMusicFromKey(holdMusicKey({ mediaId: "m1" }))).toEqual({ mediaId: "m1" });
        expect(holdMusicKey({})).toBe("preset:piano_calmo");
    });
});
