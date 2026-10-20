import { describe, expect, it } from "vitest";

import {
    FILTERABLE_MESSAGE_CHANNELS,
    channelCapabilities,
    type MessageChannel,
} from "./types";


describe("FILTERABLE_MESSAGE_CHANNELS", () => {
    it("offers every messaging channel the product supports", () => {
        for (const channel of ["whatsapp", "instagram", "facebook", "telegram", "webchat", "mercadolivre", "tiktok"] as const) {
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
            mercadolivre: true,
            tiktok: true,
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

    it("limits Messenger text to 2000 characters and Instagram text to 1000 bytes, as the backend does", () => {
        expect(channelCapabilities.textLimit("facebook")).toEqual({ max: 2000, unit: "characters" });
        expect(channelCapabilities.textLimit("instagram")).toEqual({ max: 1000, unit: "bytes" });
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

describe("channelCapabilities for Mercado Livre", () => {
    it("hands conversations to AI, follows the window the server reports, and never calls or edits", () => {
        expect(channelCapabilities.supportsAiHandling("mercadolivre")).toBe(true);
        expect(channelCapabilities.hasTimedOutboundWindow("mercadolivre")).toBe(false);
        expect(channelCapabilities.supportsCalling("mercadolivre")).toBe(false);
        expect(channelCapabilities.supportsMessageEditing("mercadolivre")).toBe(false);
    });

    it("limits text to 350 characters in the Mercado Livre charset", () => {
        expect(channelCapabilities.textLimit("mercadolivre")).toEqual({ max: 350, unit: "characters", charset: "mercadolivre" });
    });
});

describe("channelCapabilities for TikTok", () => {
    it("hands conversations to AI inside a timed window, and never calls or edits", () => {
        expect(channelCapabilities.supportsAiHandling("tiktok")).toBe(true);
        expect(channelCapabilities.hasTimedOutboundWindow("tiktok")).toBe(true);
        expect(channelCapabilities.supportsCalling("tiktok")).toBe(false);
        expect(channelCapabilities.supportsMessageEditing("tiktok")).toBe(false);
    });

    it("limits text to 6000 characters, as the backend does", () => {
        expect(channelCapabilities.textLimit("tiktok")).toEqual({ max: 6000, unit: "characters" });
    });
});
