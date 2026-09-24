import { describe, expect, it } from "vitest";

import { assigneeKind, isAutomationAssignee } from "./assignee";
import { normalizeActorKind } from "./events";

describe("assigneeKind", () => {
  it("tells a person, an agent and a workflow apart", () => {
    expect(assigneeKind("5f0c-user")).toBe("human");
    expect(assigneeKind("ai:agent-1")).toBe("ai");
    expect(assigneeKind("workflow:wf-1")).toBe("workflow");
  });

  it("is null when nobody holds the conversation", () => {
    expect(assigneeKind(undefined)).toBeNull();
    expect(assigneeKind(null)).toBeNull();
    expect(assigneeKind("  ")).toBeNull();
  });

  it("treats an agent and a workflow as automation, never a person", () => {
    expect(isAutomationAssignee("ai:agent-1")).toBe(true);
    expect(isAutomationAssignee("workflow:wf-1")).toBe(true);
    expect(isAutomationAssignee("5f0c-user")).toBe(false);
    expect(isAutomationAssignee("")).toBe(false);
  });
});

describe("normalizeActorKind", () => {
  it("keeps a workflow a workflow, from its kind or its id", () => {
    expect(normalizeActorKind("workflow", "workflow:wf-1")).toBe("workflow");
    expect(normalizeActorKind(undefined, "workflow:wf-1")).toBe("workflow");
  });
});
