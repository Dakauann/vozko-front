import { describe, expect, it } from "vitest";

import type { WorkflowGraph } from "@/lib/workflows/types";

import { lintSignature } from "./workflow-lint-signature";

const graph = (pinned?: WorkflowGraph["nodes"][number]["pinned"]): WorkflowGraph => ({
  nodes: [{ id: "n1", type: "action_http_request", position: { x: 0, y: 0 }, config: {}, ...(pinned ? { pinned } : {}) }],
  edges: [],
});

describe("lintSignature", () => {
  it("changes when a pin is added, so Alertas shows the pinned output info without a stale cache", () => {
    const pinned = graph({ output: {}, source: "manual", pinned_at: "2026-10-20T12:00:00Z" });
    expect(lintSignature("messages", pinned)).not.toBe(lintSignature("messages", graph()));
  });
});
