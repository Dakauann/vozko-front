import { describe, expect, it } from "vitest";

import { bubbleSide, directionOfRow, showsDeliveryTicks, type BubbleSide, type MessageDirection, type ThreadPerspective } from "./bubble-side";

describe("bubbleSide", () => {
  const cases: Array<{ why: string; direction: MessageDirection; perspective: ThreadPerspective; side: BubbleSide }> = [
    { why: "the CRM shows what the business sent on its own side", direction: "outbound", perspective: "business", side: "right" },
    { why: "the CRM shows the contact on the far side", direction: "inbound", perspective: "business", side: "left" },
    { why: "a tester plays the customer, so what the business sent arrives from the far side", direction: "outbound", perspective: "customer", side: "left" },
    { why: "a tester plays the customer, so the customer's own messages sit on the right", direction: "inbound", perspective: "customer", side: "right" },
  ];

  it.each(cases)("$why", ({ direction, perspective, side }) => {
    expect(bubbleSide(direction, perspective)).toBe(side);
  });
});

describe("showsDeliveryTicks", () => {
  const cases: Array<{ why: string; direction: MessageDirection; perspective: ThreadPerspective; ticks: boolean }> = [
    { why: "the business sees the delivery of what it sent", direction: "outbound", perspective: "business", ticks: true },
    { why: "the business never ticks what the contact sent", direction: "inbound", perspective: "business", ticks: false },
    { why: "the customer does not see the business's delivery ticks", direction: "outbound", perspective: "customer", ticks: false },
    { why: "the tester has no delivery report for the customer's own messages", direction: "inbound", perspective: "customer", ticks: false },
  ];

  it.each(cases)("$why", ({ direction, perspective, ticks }) => {
    expect(showsDeliveryTicks(direction, perspective)).toBe(ticks);
  });
});

describe("directionOfRow", () => {
  it("reads a thread row's outgoing flag as the business direction", () => {
    expect(directionOfRow({ outgoing: true })).toBe("outbound");
    expect(directionOfRow({ outgoing: false })).toBe("inbound");
  });
});
