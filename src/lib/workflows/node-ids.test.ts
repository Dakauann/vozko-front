import { describe, expect, it } from "vitest";

import { nextShortNodeId } from "@/lib/workflows/node-ids";

describe("nextShortNodeId", () => {
  it("starts at n1 on an empty canvas", () => {
    expect(nextShortNodeId([])).toBe("n1");
  });

  it("continues after the highest short id, the way the copilot numbers nodes", () => {
    expect(nextShortNodeId(["n1", "n4", "n2"])).toBe("n5");
  });

  it("ignores older long ids and never reuses an existing one", () => {
    expect(nextShortNodeId(["node_1790734208535_1", "n1"])).toBe("n2");
    expect(nextShortNodeId(["node_1790734208535_1"])).toBe("n1");
  });
});
