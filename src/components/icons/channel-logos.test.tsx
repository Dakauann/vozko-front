import { describe, expect, it } from "vitest";

import { ChannelLogo, hasChannelMark } from "./channel-logos";
import { FILTERABLE_MESSAGE_CHANNELS } from "@/lib/conversations/types";

/**
 * The two lists in this file must agree.
 *
 * They used not to: ChannelLogo gained an unofficial-WhatsApp case while
 * ChannelAvatar kept its own hardcoded predicate, so those conversations had a
 * mark that nothing would render and showed a bare initial in the inbox while
 * every other channel showed its network. The predicate now lives beside the
 * switch; this keeps them from drifting apart again.
 */
describe("channel marks", () => {
  it("renders a mark for exactly the channels it claims to", () => {
    for (const channel of ["whatsapp", "unofficial_whatsapp", "instagram", "telegram"]) {
      expect(hasChannelMark(channel), `${channel} should claim a mark`).toBe(true);
      expect(ChannelLogo({ channel }), `${channel} should render one`).not.toBeNull();
    }
  });

  it("claims no mark for channels it cannot draw", () => {
    // Voice is a real channel with no brand mark; the avatar must fall back to
    // the initial rather than reserve space for a badge that never arrives.
    expect(hasChannelMark("voice")).toBe(false);
    expect(ChannelLogo({ channel: "voice" })).toBeNull();
    expect(hasChannelMark(null)).toBe(false);
    expect(hasChannelMark(undefined)).toBe(false);
  });

  // Every channel an operator can FILTER by is one they will see in a row, so a
  // filter that yields rows with no mark is the gap this whole file guards.
  it("covers every filterable channel except voice", () => {
    for (const channel of FILTERABLE_MESSAGE_CHANNELS) {
      if (channel === "voice") continue;
      expect(hasChannelMark(channel), `${channel} is filterable but has no mark`).toBe(true);
    }
  });

  // The two WhatsApp transports share a silhouette on purpose — it IS WhatsApp
  // to the customer — so the distinction has to survive in the rendered output.
  // Identical marks would make a reply leave from the wrong number.
  it("distinguishes the two WhatsApp transports", () => {
    // The element TYPE, not a serialisation of it: JSON.stringify drops the
    // component function, so two different marks serialise identically and the
    // assertion would pass no matter what this returned.
    const official = ChannelLogo({ channel: "whatsapp" }) as { type: unknown };
    const unofficial = ChannelLogo({ channel: "unofficial_whatsapp" }) as { type: unknown };
    expect(official.type).not.toBe(unofficial.type);
  });
});
