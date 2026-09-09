import { describe, expect, it } from "vitest";

import { nextConversationStatuses } from "@/lib/conversations/status-actions";

describe("nextConversationStatuses", () => {
  it("offers both moves from a conversation nobody has picked up", () => {
    expect(nextConversationStatuses("new")).toEqual(["ongoing", "finished"]);
    expect(nextConversationStatuses(undefined)).toEqual([
      "ongoing",
      "finished",
    ]);
  });

  it("offers only finishing once it is being worked", () => {
    expect(nextConversationStatuses("ongoing")).toEqual(["finished"]);
  });

  // Reopening happens when the customer writes again, not from a menu, so a
  // finished conversation must not offer a move the server would refuse.
  it("offers nothing once it is finished", () => {
    expect(nextConversationStatuses("finished")).toEqual([]);
  });
});
