import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PerceptionShapes } from "./perception-shapes";

describe("people overlay for Elo's findings", () => {
  it("draws an alignment guide dashed with a tick at each end, unlike a design line", () => {
    const { container } = render(<PerceptionShapes shapes={[{ kind: "guide", from: [0.1, 0.2], to: [0.1, 0.4], tone: "ok" }]} size={{ width: 1000, height: 1000 }} />);
    const lines = [...container.querySelectorAll("line")];
    expect(lines).toHaveLength(3);
    expect(lines[0].getAttribute("stroke-dasharray")).toBeTruthy();
    expect(lines.slice(1).every((tick) => !tick.getAttribute("stroke-dasharray"))).toBe(true);
  });

  it("keeps a measured segment solid", () => {
    const { container } = render(<PerceptionShapes shapes={[{ kind: "segment", from: [0.1, 0.2], to: [0.1, 0.4], tone: "bad" }]} size={{ width: 1000, height: 1000 }} />);
    const lines = [...container.querySelectorAll("line")];
    expect(lines).toHaveLength(1);
    expect(lines[0].getAttribute("stroke-dasharray")).toBeNull();
  });
});
