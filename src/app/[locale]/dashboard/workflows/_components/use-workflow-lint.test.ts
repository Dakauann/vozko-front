/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import type { WorkflowGraph } from "@/lib/workflows/types";

import { lintSignature } from "./workflow-lint-signature";

function graph(): WorkflowGraph {
  return {
    nodes: [
      { id: "trigger", type: "trigger_message", position: { x: 0, y: 0 }, config: {} },
      {
        id: "ask",
        type: "action_send_whatsapp_button",
        position: { x: 300, y: 0 },
        config: { buttons: [{ id: "b1", title: "Sim" }] },
      },
    ],
    edges: [{ source: "trigger", target: "ask", label: "" }],
  } as unknown as WorkflowGraph;
}

describe("lintSignature", () => {
  it("is identical when only node positions change (dragging never re-lints)", () => {
    const a = graph();
    const b = graph();
    b.nodes[1].position = { x: 999, y: 777 };
    expect(lintSignature("messages", b)).toBe(lintSignature("messages", a));
  });

  it("changes when a node's config changes", () => {
    const a = graph();
    const b = graph();
    (b.nodes[1].config as Record<string, unknown>).buttons = [
      { id: "b1", title: "Sim" },
      { id: "b2", title: "Não" },
    ];
    expect(lintSignature("messages", b)).not.toBe(lintSignature("messages", a));
  });

  it("changes when the edge wiring changes", () => {
    const a = graph();
    const b = graph();
    b.edges = [];
    expect(lintSignature("messages", b)).not.toBe(lintSignature("messages", a));
  });

  it("is stable regardless of edge ordering", () => {
    const a = graph();
    a.edges = [
      { source: "trigger", target: "ask", label: "" },
      { source: "ask", target: "end", label: "b1" },
    ];
    const b = graph();
    b.edges = [
      { source: "ask", target: "end", label: "b1" },
      { source: "trigger", target: "ask", label: "" },
    ];
    expect(lintSignature("messages", b)).toBe(lintSignature("messages", a));
  });
});
