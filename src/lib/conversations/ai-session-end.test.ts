import { describe, expect, it } from "vitest";

import { aiSessionEndLine } from "./ai-session-end";

describe("aiSessionEndLine", () => {
  it("names the person who assigned the conversation away from the AI", () => {
    expect(aiSessionEndLine({ reason: "manual_assignment", enderKind: "human", ender: "Jose", to: "Victor" })).toEqual({ key: "manualAssignment", values: { actor: "Jose", to: "Victor" } });
  });

  it("names the operator who replied, even on events credited to the AI before this change", () => {
    expect(aiSessionEndLine({ reason: "human_reply", enderKind: "human", ender: "Victor", to: "Victor" })).toEqual({ key: "humanReply", values: { actor: "Victor" } });
    expect(aiSessionEndLine({ reason: "human_reply", enderKind: "ai", ender: "Agente", to: "Victor" })).toEqual({ key: "humanReply", values: { actor: "Victor" } });
  });

  it("says who paused the AI", () => {
    expect(aiSessionEndLine({ reason: "automation_paused", enderKind: "human", ender: "Victor", to: "Victor" })).toEqual({ key: "paused", values: { actor: "Victor" } });
    expect(aiSessionEndLine({ reason: "automation_paused", enderKind: "ai", ender: "Agente", to: null })).toEqual({ key: "pausedAnonymous", values: {} });
  });

  it("tells an automation's own hand-off from an operator's", () => {
    expect(aiSessionEndLine({ reason: "automation_handoff", enderKind: "ai", ender: "Agente", to: "Victor" })).toEqual({ key: "aiHandoff", values: { to: "Victor" } });
    expect(aiSessionEndLine({ reason: "automation_handoff", enderKind: "workflow", ender: "Fluxo", to: null })).toEqual({ key: "workflowHandoffTeam", values: {} });
    expect(aiSessionEndLine({ reason: "automation_handoff", enderKind: "human", ender: "Carla", to: "Ana" })).toEqual({ key: "operatorHandoff", values: { actor: "Carla", to: "Ana" } });
  });

  it("says who finished the conversation", () => {
    expect(aiSessionEndLine({ reason: "conversation_finished", enderKind: "human", ender: "Victor", to: null })).toEqual({ key: "finishedBy", values: { actor: "Victor" } });
    expect(aiSessionEndLine({ reason: "conversation_finished", enderKind: "system", ender: null, to: null })).toEqual({ key: "finished", values: {} });
  });

  it("leaves unknown reasons to the generic outcome", () => {
    expect(aiSessionEndLine({ reason: "something_new", enderKind: "system", ender: null, to: null })).toBeNull();
  });
});
