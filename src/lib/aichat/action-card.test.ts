import { describe, expect, it } from "vitest";

import { cardState } from "./action-card";
import type { ActionCard } from "./types";

function card(partial: Partial<ActionCard>): ActionCard {
  return { kind: "connect_whatsapp_business", balanceMicros: 0, subscriptionActive: true, ...partial };
}

describe("cardState", () => {
  it("is ready when the server says a number can be added and the user may do it", () => {
    const state = cardState(card({ status: { capability: "official_whatsapp", count: 0, usage: { used: 0, total: 1 }, canAdd: true } }), { permitted: true });
    expect(state).toEqual({ state: "ready", usage: { used: 0, total: 1 } });
  });

  it("prefers the live capacity over the stored snapshot", () => {
    const stored = card({ status: { capability: "official_whatsapp", count: 0, usage: { used: 0, total: 1 }, canAdd: true } });
    expect(cardState(stored, { permitted: true, live: { used: 1, total: 1, canAdd: false } })).toEqual({
      state: "at_limit",
      usage: { used: 1, total: 1 },
    });
  });

  it("never offers the action without permission, whatever the snapshot says", () => {
    const stored = card({ status: { capability: "official_whatsapp", count: 0, canAdd: true } });
    expect(cardState(stored, { permitted: false }).state).toBe("no_permission");
  });

  it("keeps the server's reason when it blocks", () => {
    const blocked = card({ status: { capability: "official_whatsapp", count: 0, canAdd: false, blocker: "unavailable" } });
    expect(cardState(blocked, { permitted: true }).state).toBe("unavailable");
  });

  it("links balance and subscription cards without a capability", () => {
    expect(cardState(card({ kind: "top_up_balance" }), { permitted: true }).state).toBe("ready");
  });
});
