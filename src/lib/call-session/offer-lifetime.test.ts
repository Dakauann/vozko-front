import { describe, expect, it } from "vitest";

import { offerRingShare, type IncomingCallOffer } from "./inbound-call-types";

const offer = (receivedAt: number, expiresAt?: string): IncomingCallOffer => ({
    offerId: "o1",
    callId: "c1",
    workspaceId: "ws1",
    fromNumber: "5584994409684",
    receivedAt,
    expiresAt,
});

describe("offer ring share", () => {
    const received = Date.parse("2026-09-30T12:00:00Z");
    const ringing = offer(received, "2026-09-30T12:00:20Z");

    it("is the share of ringing time still left", () => {
        expect(offerRingShare(ringing, received)).toBe(1);
        expect(offerRingShare(ringing, received + 5_000)).toBe(0.75);
        expect(offerRingShare(ringing, received + 30_000)).toBe(0);
    });

    it("is unknown without a deadline", () => {
        expect(offerRingShare(offer(received), received)).toBeNull();
        expect(offerRingShare(offer(received, "not a date"), received)).toBeNull();
        expect(offerRingShare(offer(received, "2026-09-30T11:59:00Z"), received)).toBeNull();
    });
});
