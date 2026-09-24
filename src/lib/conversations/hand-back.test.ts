import { describe, expect, it } from "vitest";

import { handBackTarget, leavesViewerAfterHandBack } from "./hand-back";

describe("handBackTarget", () => {
  it("names the agent a person's conversation would go back to", () => {
    expect(
      handBackTarget({
        assigned_user_id: "5f0c-user",
        ai_handler: { kind: "agent", agent_name: "Sofia" },
      }),
    ).toEqual({ kind: "ai", name: "Sofia" });
  });

  it("names the workflow when the channel runs one", () => {
    expect(
      handBackTarget({
        assigned_user_id: "5f0c-user",
        ai_handler: { kind: "workflow", workflow_name: "Triagem" },
      }),
    ).toEqual({ kind: "workflow", name: "Triagem" });
  });

  it("also offers it for the team queue, which the automation would take too", () => {
    expect(
      handBackTarget({ assigned_user_id: null, ai_handler: { kind: "agent", agent_name: "Sofia" } }),
    ).toEqual({ kind: "ai", name: "Sofia" });
  });

  it("offers nothing when no agent or workflow would answer", () => {
    expect(handBackTarget({ assigned_user_id: "5f0c-user", ai_handler: null })).toBeNull();
  });

  it("offers nothing when the automation already holds it", () => {
    expect(
      handBackTarget({
        assigned_user_id: "ai:agent-1",
        ai_handler: { kind: "agent", agent_name: "Sofia" },
      }),
    ).toBeNull();
  });

  it("falls back to a generic name when the handler has none", () => {
    expect(
      handBackTarget({ assigned_user_id: "5f0c-user", ai_handler: { kind: "agent" } }),
    ).toEqual({ kind: "ai", name: "IA" });
  });
});

describe("leavesViewerAfterHandBack", () => {
  it("drops the row for someone who cannot see others' conversations", () => {
    expect(leavesViewerAfterHandBack("ai:agent-1", false)).toBe(true);
    expect(leavesViewerAfterHandBack("workflow:wf-1", false)).toBe(true);
  });

  it("keeps it for admins, owners and view-others", () => {
    expect(leavesViewerAfterHandBack("ai:agent-1", true)).toBe(false);
  });

  it("keeps it when nothing took it back", () => {
    expect(leavesViewerAfterHandBack("5f0c-user", false)).toBe(false);
    expect(leavesViewerAfterHandBack("", false)).toBe(false);
  });
});
