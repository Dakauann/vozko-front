import { describe, expect, it } from "vitest";

import {
    FILTERABLE_MESSAGE_CHANNELS,
    channelCapabilities,
    type MessageChannel,
} from "./types";


describe("FILTERABLE_MESSAGE_CHANNELS", () => {
    it("offers every messaging channel the product supports", () => {
        for (const channel of ["whatsapp", "instagram", "facebook", "telegram", "webchat"] as const) {
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
            facebook: true,
            telegram: true,
            webchat: true,
        };
        for (const channel of Object.keys(covered) as MessageChannel[]) {
            expect(FILTERABLE_MESSAGE_CHANNELS).toContain(channel);
        }
    });
});

describe("channelCapabilities for Messenger", () => {
    it("has a timed window and AI handling, but no calls or edits", () => {
        expect(channelCapabilities.hasTimedOutboundWindow("facebook")).toBe(true);
        expect(channelCapabilities.supportsAiHandling("facebook")).toBe(true);
        expect(channelCapabilities.supportsCalling("facebook")).toBe(false);
        expect(channelCapabilities.supportsMessageEditing("facebook")).toBe(false);
    });

    it("limits Messenger text to 2000 characters and leaves other channels unlimited here", () => {
        expect(channelCapabilities.textLimit("facebook")).toBe(2000);
        expect(channelCapabilities.textLimit("instagram")).toBeNull();
        expect(channelCapabilities.textLimit("whatsapp")).toBeNull();
    });
});

describe("channelCapabilities for the website chat", () => {
    it("hands conversations to AI, with no calls, edits or timed window", () => {
        expect(channelCapabilities.supportsAiHandling("webchat")).toBe(true);
        expect(channelCapabilities.supportsCalling("webchat")).toBe(false);
        expect(channelCapabilities.supportsMessageEditing("webchat")).toBe(false);
        expect(channelCapabilities.hasTimedOutboundWindow("webchat")).toBe(false);
    });
});
