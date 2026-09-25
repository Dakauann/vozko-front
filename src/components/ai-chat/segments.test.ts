import { describe, expect, it } from "vitest";

import { finishTool, isThinkingBetweenSteps, startTool, type Segment } from "./segments";

describe("tool segments", () => {
  it("shows a tool as running the moment it starts, then settles the same line", () => {
    const running = startTool([], "attendance_metrics");
    expect(running).toEqual([{ kind: "tool", name: "attendance_metrics", summary: "", ok: true, running: true }]);
    expect(finishTool(running, "attendance_metrics", "ok", true)).toEqual([
      { kind: "tool", name: "attendance_metrics", summary: "ok", ok: true },
    ]);
  });

  it("settles the matching tool when several run in one step", () => {
    const segs = startTool(startTool([], "attendance_team"), "attendance_trend");
    const out = finishTool(segs, "attendance_team", "error", false);
    expect(out[0]).toEqual({ kind: "tool", name: "attendance_team", summary: "error", ok: false });
    expect(out[1]).toMatchObject({ name: "attendance_trend", running: true });
  });

  it("still records a result that never announced its start (older servers)", () => {
    expect(finishTool([], "calculate", "ok", true)).toEqual([{ kind: "tool", name: "calculate", summary: "ok", ok: true }]);
  });
});

describe("isThinkingBetweenSteps", () => {
  const text = (streaming: boolean): Segment => ({ kind: "text", text: "a", streaming });
  it("is on while the model works with nothing streaming", () => {
    expect(isThinkingBetweenSteps([])).toBe(true);
    expect(isThinkingBetweenSteps([text(false)])).toBe(true);
    expect(isThinkingBetweenSteps([{ kind: "tool", name: "x", summary: "ok", ok: true }])).toBe(true);
  });
  it("is off while words or a running tool already show progress", () => {
    expect(isThinkingBetweenSteps([text(true)])).toBe(false);
    expect(isThinkingBetweenSteps([{ kind: "thinking", text: "", streaming: true }])).toBe(false);
    expect(isThinkingBetweenSteps(startTool([], "x"))).toBe(false);
  });
});
