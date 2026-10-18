import { describe, expect, it } from "vitest";

import { findingsByLevel, launchAllowed, type LaunchReport } from "./launch-check";

const report = (overrides: Partial<LaunchReport>): LaunchReport => ({
  findings: [],
  fingerprint: "",
  blocks: false,
  needsConfirmation: false,
  ...overrides,
});

describe("launch check", () => {
  it("groups findings by level in the order the person must read them", () => {
    const grouped = findingsByLevel(
      report({
        findings: [
          { code: "opted_out_pending", level: "advice", observed: 3 },
          { code: "template_red", level: "confirm" },
          { code: "phone_unavailable", level: "block" },
        ],
      }),
    );
    expect(grouped.block.map((f) => f.code)).toEqual(["phone_unavailable"]);
    expect(grouped.confirm.map((f) => f.code)).toEqual(["template_red"]);
    expect(grouped.advice.map((f) => f.code)).toEqual(["opted_out_pending"]);
  });

  it("never allows a launch that blocks", () => {
    expect(launchAllowed(report({ blocks: true }), true)).toBe(false);
  });

  it("allows risks only once they are confirmed", () => {
    const risky = report({ needsConfirmation: true, fingerprint: "abc" });
    expect(launchAllowed(risky, false)).toBe(false);
    expect(launchAllowed(risky, true)).toBe(true);
  });

  it("allows a clean report without a confirmation", () => {
    expect(launchAllowed(report({}), false)).toBe(true);
  });
});
