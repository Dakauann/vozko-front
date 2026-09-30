import { describe, expect, it } from "vitest";

import { callChannelOf } from "./channel";

describe("call channel", () => {
    it("reads the channels the server sends", () => {
        expect(callChannelOf("sip")).toBe("sip");
        expect(callChannelOf("whatsapp")).toBe("whatsapp");
    });

    it("does not guess a channel it does not know", () => {
        expect(callChannelOf("fax")).toBeNull();
        expect(callChannelOf(undefined)).toBeNull();
        expect(callChannelOf(null)).toBeNull();
    });
});
