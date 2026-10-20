import { describe, expect, it } from "vitest";

import {
  advanceBuilderSession,
  builderSocketPath,
  initialBuilderSession,
  shouldRestartBuilderSession,
  type BuilderIdentity,
} from "./builder-session";

describe("shouldRestartBuilderSession", () => {
  const cases: { why: string; prev: BuilderIdentity; next: BuilderIdentity; restart: boolean }[] = [
    { why: "a new workflow receiving its first id keeps the running build", prev: { workflowId: "", workspaceId: "w1" }, next: { workflowId: "wf1", workspaceId: "w1" }, restart: false },
    { why: "the same identity is not a new session", prev: { workflowId: "wf1", workspaceId: "w1" }, next: { workflowId: "wf1", workspaceId: "w1" }, restart: false },
    { why: "an empty new workflow staying empty is not a new session", prev: { workflowId: "", workspaceId: "w1" }, next: { workflowId: "", workspaceId: "w1" }, restart: false },
    { why: "moving to a different saved workflow is a different conversation", prev: { workflowId: "wf1", workspaceId: "w1" }, next: { workflowId: "wf2", workspaceId: "w1" }, restart: true },
    { why: "opening a new workflow from a saved one goes back to the create route", prev: { workflowId: "wf1", workspaceId: "w1" }, next: { workflowId: "", workspaceId: "w1" }, restart: true },
    { why: "a workspace switch always starts over, even for a new workflow", prev: { workflowId: "", workspaceId: "w1" }, next: { workflowId: "", workspaceId: "w2" }, restart: true },
    { why: "a workspace switch during creation starts over", prev: { workflowId: "", workspaceId: "w1" }, next: { workflowId: "wf1", workspaceId: "w2" }, restart: true },
    { why: "a workspace switch on a saved workflow starts over", prev: { workflowId: "wf1", workspaceId: "w1" }, next: { workflowId: "wf1", workspaceId: "w2" }, restart: true },
  ];
  for (const c of cases) {
    it(c.why, () => {
      expect(shouldRestartBuilderSession(c.prev, c.next)).toBe(c.restart);
    });
  }
});

describe("advanceBuilderSession", () => {
  const start = initialBuilderSession({ workflowId: "", workspaceId: "w1" });

  it("returns the same session when nothing changed, so render does not loop", () => {
    expect(advanceBuilderSession(start, { workflowId: "", workspaceId: "w1" })).toBe(start);
  });

  it("adopts the created id without a new epoch", () => {
    const next = advanceBuilderSession(start, { workflowId: "wf1", workspaceId: "w1" });
    expect(next).toEqual({ workflowId: "wf1", workspaceId: "w1", epoch: start.epoch });
  });

  it("bumps the epoch when the editor moves to another workflow", () => {
    const created = advanceBuilderSession(start, { workflowId: "wf1", workspaceId: "w1" });
    const moved = advanceBuilderSession(created, { workflowId: "wf2", workspaceId: "w1" });
    expect(moved.epoch).toBe(start.epoch + 1);
    expect(moved.workflowId).toBe("wf2");
  });
});

describe("builderSocketPath", () => {
  it("uses the create route while the workflow has no id", () => {
    expect(builderSocketPath("")).toBe("/ws/workflows/ai-builder");
  });

  it("uses the edit route once the workflow has an id, escaping it", () => {
    expect(builderSocketPath("wf/1")).toBe("/ws/workflows/wf%2F1/ai-builder");
  });
});
