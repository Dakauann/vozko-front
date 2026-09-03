import { describe, expect, it } from "vitest";

import {
    blockingBindings,
    refusalFromMessage,
    type PipelineUsage,
} from "@/lib/crm/pipelines";
import { STAGE_COLORS, nextStageColor } from "@/lib/crm/stage-colors";

const usage = (over: Partial<PipelineUsage> = {}): PipelineUsage => ({
    entries: 0,
    campaigns: 0,
    channels: 0,
    opportunities: 0,
    ...over,
});

describe("blockingBindings", () => {
    it("counts only what must be unlinked at its own source", () => {
        expect(blockingBindings(usage({ campaigns: 2, channels: 1, opportunities: 3 }))).toBe(6);
    });

    // Conversations are movable, so they never block: naming a destination is
    // how the operator deals with them. Folding them into this number would
    // make every busy funnel look permanently undeletable.
    it("ignores conversations", () => {
        expect(blockingBindings(usage({ entries: 4000 }))).toBe(0);
    });
});

describe("refusalFromMessage", () => {
    it.each([
        ["pipeline: the default funnel cannot be deleted", "default"],
        ["pipeline: funnel is still in use", "bound"],
        ["pipeline: funnel holds conversations; name a destination funnel", "needsDestination"],
        ["pipeline: destination must be a different funnel of the same kind", "destinationInvalid"],
    ])("maps %s", (message, expected) => {
        expect(refusalFromMessage(message)).toBe(expected);
    });

    it("is case insensitive, because the sentence is not a contract the way the code is", () => {
        expect(refusalFromMessage("Pipeline: Funnel Is STILL IN USE")).toBe("bound");
    });

    // A guard added on the server that this build has not learned yet must fall
    // through to the server's own words, never to an empty dialog.
    it("returns undefined for an unknown refusal", () => {
        expect(refusalFromMessage("pipeline: some future guard")).toBeUndefined();
    });
});

describe("nextStageColor", () => {
    it("takes the first colour nothing is using", () => {
        expect(nextStageColor([])).toBe(STAGE_COLORS[0]);
        expect(nextStageColor([STAGE_COLORS[0]])).toBe(STAGE_COLORS[1]);
    });

    it("ignores case, so a hand-typed hex still counts as used", () => {
        expect(nextStageColor([STAGE_COLORS[0].toLowerCase()])).toBe(STAGE_COLORS[1]);
    });

    // Past the palette every colour is taken. Wrapping keeps the funnel legible
    // instead of stacking a thirteenth column on the twelfth's colour.
    it("wraps once every colour is in use", () => {
        const all = [...STAGE_COLORS];
        expect(nextStageColor(all)).toBe(STAGE_COLORS[all.length % STAGE_COLORS.length]);
    });
});
