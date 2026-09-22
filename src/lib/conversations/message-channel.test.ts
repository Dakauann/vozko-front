import { describe, expect, it } from "vitest";

import {
    FILTERABLE_MESSAGE_CHANNELS,
    type EntryType,
    type MessageChannel,
} from "./types";


describe("FILTERABLE_MESSAGE_CHANNELS", () => {
    it("offers every messaging channel the product supports", () => {
        for (const channel of ["whatsapp", "instagram", "telegram"] as const) {
            expect(FILTERABLE_MESSAGE_CHANNELS).toContain(channel);
        }
    });

    it("lists each channel exactly once", () => {
        const seen = new Set(FILTERABLE_MESSAGE_CHANNELS);
        expect(seen.size).toBe(FILTERABLE_MESSAGE_CHANNELS.length);
    });

    it("covers the MessageChannel union exhaustively", () => {
        const covered: Record<MessageChannel, true> = {
            whatsapp: true,
            unofficial_whatsapp: true,
            instagram: true,
            telegram: true,
        };
        for (const channel of Object.keys(covered) as MessageChannel[]) {
            expect(FILTERABLE_MESSAGE_CHANNELS).toContain(channel);
        }
    });
});

describe("channel vs entry type", () => {
    it("keeps entry-only kinds out of the channel filter", () => {
        for (const entryOnly of ["support"] as EntryType[]) {
            expect(FILTERABLE_MESSAGE_CHANNELS).not.toContain(
                entryOnly as unknown as MessageChannel,
            );
        }
    });
});
