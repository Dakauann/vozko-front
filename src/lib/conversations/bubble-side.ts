export type ThreadPerspective = "business" | "customer";

export type MessageDirection = "outbound" | "inbound";

export type BubbleSide = "left" | "right";

const SIDES: Record<ThreadPerspective, Record<MessageDirection, BubbleSide>> = {
  business: { outbound: "right", inbound: "left" },
  customer: { outbound: "left", inbound: "right" },
};

export function bubbleSide(direction: MessageDirection, perspective: ThreadPerspective): BubbleSide {
  return SIDES[perspective][direction];
}

export function showsDeliveryTicks(direction: MessageDirection, perspective: ThreadPerspective): boolean {
  return direction === "outbound" && bubbleSide(direction, perspective) === "right";
}

export function directionOfRow(row: { outgoing: boolean }): MessageDirection {
  return row.outgoing ? "outbound" : "inbound";
}
