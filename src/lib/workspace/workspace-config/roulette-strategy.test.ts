import { describe, expect, it } from "vitest";

import type { RouletteRecipient, WorkspaceConfig } from "./types";
import {
  ROULETTE_STRATEGIES,
  choosesFromRecipients,
  maxOpenOf,
  recipientsOf,
  rouletteStrategyOf,
  sameRecipients,
  withRecipient,
} from "./roulette";

const config = (over: Partial<WorkspaceConfig>): WorkspaceConfig => ({ ...(over as WorkspaceConfig) });

describe("rouletteStrategyOf", () => {
  it("lists every strategy the server knows, round robin first", () => {
    expect(ROULETTE_STRATEGIES).toEqual(["round_robin", "priority", "weighted", "least_busy", "longest_idle", "random", "claim"]);
  });

  it("reads round robin when nothing or something unknown is stored", () => {
    expect(rouletteStrategyOf(null)).toBe("round_robin");
    expect(rouletteStrategyOf(config({ rouletteStrategy: "bogus" as never }))).toBe("round_robin");
    expect(rouletteStrategyOf(config({ rouletteStrategy: "least_busy" }))).toBe("least_busy");
  });
});

describe("choosesFromRecipients", () => {
  it("is true only for the strategies that need a list", () => {
    expect(ROULETTE_STRATEGIES.filter(choosesFromRecipients)).toEqual(["priority", "weighted"]);
  });
});

describe("maxOpenOf", () => {
  it("reads no limit as zero and clamps like the server", () => {
    expect(maxOpenOf(null)).toBe(0);
    expect(maxOpenOf(config({ rouletteMaxOpenPerMember: -2 }))).toBe(0);
    expect(maxOpenOf(config({ rouletteMaxOpenPerMember: 9 }))).toBe(9);
    expect(maxOpenOf(config({ rouletteMaxOpenPerMember: 900 }))).toBe(500);
  });
});

describe("recipients", () => {
  const ana: RouletteRecipient = { userId: "ana", tier: 2, weight: 1 };
  const bob: RouletteRecipient = { userId: "bob", tier: 1, weight: 3 };

  it("orders the stored list by tier, then member", () => {
    expect(recipientsOf(config({ rouletteRecipients: [ana, bob] }))).toEqual([bob, ana]);
    expect(recipientsOf(null)).toEqual([]);
  });

  it("adds, updates and removes a member without touching the others", () => {
    const added = withRecipient([bob], "ana", { tier: 2, weight: 1 });
    expect(added).toEqual([bob, ana]);
    expect(withRecipient(added, "ana", { tier: 1 })).toEqual([{ ...ana, tier: 1 }, bob]);
    expect(withRecipient(added, "bob", null)).toEqual([ana]);
  });

  it("starts a new member at the first tier with weight one", () => {
    expect(withRecipient([], "cid", {})).toEqual([{ userId: "cid", tier: 1, weight: 1 }]);
  });

  it("keeps tier and weight inside the server limits", () => {
    expect(withRecipient([], "cid", { tier: 40, weight: 0 })).toEqual([{ userId: "cid", tier: 10, weight: 1 }]);
  });

  it("compares lists regardless of order", () => {
    expect(sameRecipients([ana, bob], [bob, ana])).toBe(true);
    expect(sameRecipients([ana], [{ ...ana, weight: 2 }])).toBe(false);
    expect(sameRecipients([ana], [ana, bob])).toBe(false);
  });
});
