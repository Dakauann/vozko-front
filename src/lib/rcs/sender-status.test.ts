import { describe, expect, it } from "vitest";

import { SENDER_TRACK, senderStatusTone, senderTrackIndex } from "@/lib/rcs/sender-status";

describe("sender status track", () => {
  it("walks the five states of a sender in order", () => {
    expect(SENDER_TRACK).toEqual(["draft", "submitted", "awaiting_confirmation", "launched", "paused"]);
  });

  it("places each status on the track", () => {
    expect(senderTrackIndex("draft")).toBe(0);
    expect(senderTrackIndex("awaiting_confirmation")).toBe(2);
    expect(senderTrackIndex("paused")).toBe(4);
  });

  it("sends a rejected sender back to the draft step", () => {
    expect(senderTrackIndex("rejected")).toBe(0);
  });

  it("gives each status a solid chip tone", () => {
    expect(senderStatusTone("launched")).toBe("healthy");
    expect(senderStatusTone("paused")).toBe("warning");
    expect(senderStatusTone("rejected")).toBe("fault");
    expect(senderStatusTone("submitted")).toBe("neutral");
    expect(senderStatusTone("awaiting_confirmation")).toBe("neutral");
    expect(senderStatusTone("draft")).toBe("muted");
  });
});
