import { describe, expect, it } from "vitest";

import {
    FILTERABLE_MESSAGE_CHANNELS,
    type EntryType,
    type MessageChannel,
} from "./types";

/**
 * The inbox filters by message channel, and that list had been spelled out
 * inline in four places. Each new channel was added to some of them: Telegram
 * reached the inbox with no filter option at all, and a Telegram row rendered a
 * telephone icon because the icon chain tested whatsapp, then instagram, then
 * fell through to the voice branch.
 *
 * These pin the list itself, so a channel that exists in the type but is absent
 * from the filter — or vice versa — fails here rather than in the UI.
 */

describe("FILTERABLE_MESSAGE_CHANNELS", () => {
    it("offers every messaging channel the product supports", () => {
        for (const channel of ["whatsapp", "instagram", "telegram"] as const) {
            expect(FILTERABLE_MESSAGE_CHANNELS).toContain(channel);
        }
    });

    it("includes voice, which is filterable but is not a messaging channel", () => {
        expect(FILTERABLE_MESSAGE_CHANNELS).toContain("voice");
    });

    it("lists each channel exactly once", () => {
        const seen = new Set(FILTERABLE_MESSAGE_CHANNELS);
        expect(seen.size).toBe(FILTERABLE_MESSAGE_CHANNELS.length);
    });

    // The dropdown maps over this array, so its order is the order an operator
    // reads. Messaging channels lead; voice is the odd one out and trails.
    it("puts voice last", () => {
        expect(FILTERABLE_MESSAGE_CHANNELS[FILTERABLE_MESSAGE_CHANNELS.length - 1]).toBe("voice");
    });

    // Exhaustiveness: if MessageChannel gains a member and the list does not,
    // this stops compiling rather than shipping an unfilterable channel.
    it("covers the MessageChannel union exhaustively", () => {
        const covered: Record<MessageChannel, true> = {
            whatsapp: true,
            instagram: true,
            telegram: true,
            voice: true,
        };
        for (const channel of Object.keys(covered) as MessageChannel[]) {
            expect(FILTERABLE_MESSAGE_CHANNELS).toContain(channel);
        }
    });
});

describe("channel vs entry type", () => {
    // They are different vocabularies and were conflated by the inline unions.
    // 'sip' and 'support' are entry kinds with no message channel of their own.
    it("keeps entry-only kinds out of the channel filter", () => {
        for (const entryOnly of ["sip", "support"] as EntryType[]) {
            expect(FILTERABLE_MESSAGE_CHANNELS).not.toContain(
                entryOnly as unknown as MessageChannel,
            );
        }
    });
});
