import { describe, expect, it } from "vitest";

import { finishTool, isThinkingBetweenSteps, layoutSegments, startTool, type Segment } from "./segments";

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

describe("layoutSegments", () => {
  const chart = (title: string): Segment => ({
    kind: "chart",
    chart: { type: "bar", title, xLabel: "x", xKind: "text", categories: ["a"], series: [] },
  });
  const tool: Segment = { kind: "tool", name: "render_chart", summary: "ok", ok: true };
  const text: Segment = { kind: "text", text: "Veja:" };

  it("puts the charts of one step side by side, with their tool lines above them", () => {
    const blocks = layoutSegments([text, tool, chart("A"), tool, chart("B"), { kind: "text", text: "Resumo" }]);
    expect(blocks.map((b) => b.kind)).toEqual(["text", "tool", "tool", "charts", "text"]);
    const grid = blocks[3];
    expect(grid.kind === "charts" && grid.charts.map((c) => c.title)).toEqual(["A", "B"]);
  });

  it("keeps charts separated by words in their own places", () => {
    const blocks = layoutSegments([chart("A"), text, chart("B")]);
    expect(blocks.map((b) => b.kind)).toEqual(["charts", "text", "charts"]);
  });

  it("leaves segments without charts untouched", () => {
    expect(layoutSegments([text, tool])).toEqual([text, tool]);
  });
});
