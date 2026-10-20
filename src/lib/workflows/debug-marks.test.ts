import { describe, expect, it } from "vitest";

import { NODE_ACTIVE, NODE_BREAKPOINT, NODE_PAUSED, NODE_REAL_CALL, hasDebugFlag, nodeDebugFlags, type NodeDebugMarks } from "./debug-marks";

const marks: NodeDebugMarks = {
  breakpoints: new Set(["a", "b"]),
  realCalls: new Set(["b", "c"]),
  pausedNodeId: "b",
  activeNodeId: "c",
};

describe("nodeDebugFlags", () => {
  it("is zero outside the editor, so other canvases keep their look", () => {
    expect(nodeDebugFlags(null, "a")).toBe(0);
  });

  it("combines every mark of a node into one number, so a node re-renders only when its own marks change", () => {
    expect(nodeDebugFlags(marks, "a")).toBe(NODE_BREAKPOINT);
    expect(nodeDebugFlags(marks, "b")).toBe(NODE_BREAKPOINT | NODE_REAL_CALL | NODE_PAUSED);
    expect(nodeDebugFlags(marks, "c")).toBe(NODE_REAL_CALL | NODE_ACTIVE);
    expect(nodeDebugFlags(marks, "z")).toBe(0);
  });
});

describe("hasDebugFlag", () => {
  it("reads one mark out of the flags", () => {
    const flags = NODE_BREAKPOINT | NODE_PAUSED;
    expect(hasDebugFlag(flags, NODE_BREAKPOINT)).toBe(true);
    expect(hasDebugFlag(flags, NODE_PAUSED)).toBe(true);
    expect(hasDebugFlag(flags, NODE_REAL_CALL)).toBe(false);
  });
});
