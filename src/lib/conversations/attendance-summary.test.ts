import { describe, expect, it } from "vitest";

import {
  ownerLineNamesTheAutomation,
  buildConversationAttendanceSummary,
  isAiCurrentlyAttending,
} from "./attendance-summary";

function owner(assignedUserId: string | null, assignedUsername: string | null = null) {
  const s = buildConversationAttendanceSummary({ events: [], assignedUserId, assignedUsername });
  return { kind: s.ownerKind, label: s.ownerLabel };
}

describe("attendance owner", () => {
  it("names the agent, the workflow or the person holding the conversation", () => {
    expect(owner("ai:agent-1", "Sofia")).toEqual({ kind: "ai", label: "Sofia" });
    expect(owner("workflow:wf-1", "Triagem")).toEqual({ kind: "workflow", label: "Triagem" });
    expect(owner("5f0c-user", "ana")).toEqual({ kind: "human", label: "ana" });
  });

  it("is unassigned when nobody holds it and no automation spoke", () => {
    expect(owner(null)).toEqual({ kind: "unassigned", label: null });
  });
});

describe("isAiCurrentlyAttending", () => {
  it("is the automation while an agent or a workflow holds the conversation", () => {
    expect(isAiCurrentlyAttending({ assignedUserId: "ai:agent-1" })).toBe(true);
    expect(isAiCurrentlyAttending({ assignedUserId: "workflow:wf-1" })).toBe(true);
  });

  it("is not the automation once a person holds it, it is paused, or it is finished", () => {
    expect(isAiCurrentlyAttending({ assignedUserId: "5f0c-user" })).toBe(false);
    expect(isAiCurrentlyAttending({ assignedUserId: "ai:agent-1", automationEnabled: false })).toBe(false);
    expect(isAiCurrentlyAttending({ assignedUserId: "ai:agent-1", conversationStatus: "finished" })).toBe(false);
  });
});

// The inbox card names the owner on its last line; when that owner is the
// running agent or workflow, the IA/Fluxo chip would say the same thing twice.
describe("ownerLineNamesTheAutomation", () => {
  it("is true when a running agent or workflow owns the conversation", () => {
    expect(ownerLineNamesTheAutomation("ai:agent-1", true)).toBe(true);
    expect(ownerLineNamesTheAutomation("workflow:wf-1", undefined)).toBe(true);
  });

  it("keeps the chip where it is the only sign of automation", () => {
    expect(ownerLineNamesTheAutomation("", true)).toBe(false);
    expect(ownerLineNamesTheAutomation(null, true)).toBe(false);
    expect(ownerLineNamesTheAutomation("user-1", true)).toBe(false);
  });

  it("keeps the chip while the owning automation is paused, to show it", () => {
    expect(ownerLineNamesTheAutomation("ai:agent-1", false)).toBe(false);
  });
});
