import { describe, expect, it } from "vitest";

import type { SimEvent, SimStep } from "./sim-session";
import { simTimeline } from "./sim-timeline";

function step(id: string, overrides: Partial<SimStep> = {}): SimEvent {
  return {
    type: "step",
    step: { id, runId: "sim", nodeId: `node-${id}`, nodeType: "action_send_message", status: "executed", executedAt: "", attempt: 1, durationMs: 4, stepIndex: 0, ...overrides },
  };
}

function message(id: string): SimEvent {
  return { type: "message", direction: "outbound", text: id, msgType: "text", messageId: id };
}

function shape(events: SimEvent[], pause: { nodeId: string; stepIndex: number } | null = null) {
  return simTimeline(events, 0, pause).map((item) => {
    if (item.kind === "steps") return `steps(${item.steps.map((entry) => entry.id).join(",")})`;
    if (item.kind === "step") return item.compact ? `lone(${item.step.id})` : `step(${item.step.id})`;
    return item.event.type === "message" ? `message(${item.event.messageId})` : item.event.type;
  });
}

describe("simTimeline", () => {
  it("folds two or more steps between two messages into one group and leaves a lone step as its own compact row, keeping the order", () => {
    expect(shape([message("in"), step("a"), message("out"), step("b"), step("c", { stepIndex: 2 }), step("d", { stepIndex: 3 }), message("img"), step("e")])).toEqual([
      "message(in)",
      "lone(a)",
      "message(out)",
      "steps(b,c,d)",
      "message(img)",
      "lone(e)",
    ]);
  });

  it("starts a group at two consecutive steps, since a group of one hides a step behind an extra click", () => {
    expect(shape([message("in"), step("a"), message("out")])).toEqual(["message(in)", "lone(a)", "message(out)"]);
    expect(shape([message("in"), step("a"), step("b", { stepIndex: 1 }), message("out")])).toEqual(["message(in)", "steps(a,b)", "message(out)"]);
  });

  it("keys a lone step like the group it would start, so it becomes that group when a second step arrives", () => {
    const lone = simTimeline([message("m"), step("a")], 40, null);
    const grown = simTimeline([message("m"), step("a"), step("b")], 40, null);
    expect(lone[1]).toMatchObject({ kind: "step", compact: true });
    expect(grown[1]).toMatchObject({ kind: "steps", key: lone[1].key });
  });

  it("never marks a failed, waiting or paused step as compact", () => {
    const items = simTimeline([step("a", { status: "failed" }), message("m"), step("b", { status: "waiting" })], 0, null);
    expect(items.filter((item) => item.kind === "step").map((item) => item.kind === "step" && item.compact)).toEqual([false, false]);
  });

  it("adds up the durations of a group", () => {
    const [group] = simTimeline([step("a", { durationMs: 3 }), step("b", { durationMs: 9 })], 0, null);
    expect(group).toMatchObject({ kind: "steps", durationMs: 12 });
  });

  it("keeps a failed step outside the group, so a problem is never folded away", () => {
    expect(shape([step("a"), step("b", { status: "failed" }), step("c")])).toEqual(["lone(a)", "step(b)", "lone(c)"]);
  });

  it("keeps a waiting step outside the group", () => {
    expect(shape([step("a"), step("b", { status: "waiting" })])).toEqual(["lone(a)", "step(b)"]);
  });

  it("keeps the step the run is paused on outside the group", () => {
    expect(shape([step("a", { stepIndex: 0 }), step("b", { stepIndex: 1 }), step("c", { stepIndex: 2 })], { nodeId: "node-b", stepIndex: 1 })).toEqual([
      "lone(a)",
      "step(b)",
      "lone(c)",
    ]);
  });

  it("does not pull out an earlier run of the paused node", () => {
    expect(shape([step("a", { nodeId: "loop", stepIndex: 0 }), step("b", { nodeId: "loop", stepIndex: 1 })], { nodeId: "loop", stepIndex: 1 })).toEqual([
      "lone(a)",
      "step(b)",
    ]);
  });

  it("breaks a group at a system line, which stays in its place", () => {
    expect(shape([step("a"), { type: "reply_ignored", nodeId: "n" }, step("b")])).toEqual(["lone(a)", "reply_ignored", "lone(b)"]);
  });

  it("keys every item from its absolute place in the session, so a group keeps its key as steps arrive", () => {
    const first = simTimeline([message("m"), step("a")], 40, null);
    const later = simTimeline([message("m"), step("a"), step("b")], 40, null);
    expect(first.map((item) => item.key)).toEqual(later.slice(0, 2).map((item) => item.key));
    expect(new Set(later.map((item) => item.key)).size).toBe(later.length);
  });
});
