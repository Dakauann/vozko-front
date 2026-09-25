import { describe, expect, it } from "vitest";

import { ChannelLogo, hasChannelMark } from "./channel-logos";
import { FILTERABLE_MESSAGE_CHANNELS } from "@/lib/conversations/types";

describe("channel marks", () => {
  it("renders a mark for exactly the channels it claims to", () => {
    for (const channel of ["whatsapp", "unofficial_whatsapp", "instagram", "telegram"]) {
      expect(hasChannelMark(channel), `${channel} should claim a mark`).toBe(true);
      expect(ChannelLogo({ channel }), `${channel} should render one`).not.toBeNull();
    }
  });

  it("claims no mark for channels it cannot draw", () => {
    expect(hasChannelMark("fax")).toBe(false);
    expect(ChannelLogo({ channel: "fax" })).toBeNull();
    expect(hasChannelMark(null)).toBe(false);
    expect(hasChannelMark(undefined)).toBe(false);
  });

  it("covers every filterable channel except voice", () => {
    for (const channel of FILTERABLE_MESSAGE_CHANNELS) {
      expect(hasChannelMark(channel), `${channel} is filterable but has no mark`).toBe(true);
    }
  });

  it("distinguishes the two WhatsApp transports", () => {
    const official = ChannelLogo({ channel: "whatsapp" }) as { type: unknown };
    const unofficial = ChannelLogo({ channel: "unofficial_whatsapp" }) as { type: unknown };
    expect(official.type).not.toBe(unofficial.type);
  });
});
