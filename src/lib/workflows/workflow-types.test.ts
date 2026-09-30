import { describe, expect, it } from "vitest";

import {
  WORKFLOW_TYPES,
  definitionAllowedForType,
  workflowTypeOfTrigger,
  workflowTypeOfTriggerDefinition,
} from "@/lib/workflows/workflow-types";

const def = (type: string, category: string, scopes: ("shared" | "whatsapp" | "voice")[]) =>
  ({ type, category, scopes }) as Parameters<typeof definitionAllowedForType>[1];

describe("workflow types", () => {
  it("offers messages and voice", () => {
    expect(WORKFLOW_TYPES).toEqual(["messages", "voice"]);
  });

  it("keeps voice nodes and messaging nodes apart", () => {
    const playAudio = def("action_play_audio", "action", ["voice"]);
    const setVariable = def("action_set_variable", "logic", ["shared"]);
    const sendText = def("action_send_text", "messaging", ["whatsapp"]);
    const end = def("end", "end", ["shared", "voice"]);

    expect(definitionAllowedForType("voice", playAudio)).toBe(true);
    expect(definitionAllowedForType("messages", playAudio)).toBe(false);
    expect(definitionAllowedForType("voice", setVariable)).toBe(false);
    expect(definitionAllowedForType("messages", setVariable)).toBe(true);
    expect(definitionAllowedForType("voice", sendText)).toBe(false);
    expect(definitionAllowedForType("voice", end)).toBe(true);
    expect(definitionAllowedForType("messages", end)).toBe(true);
  });

  it("lets decorations and groups live in any workflow", () => {
    expect(definitionAllowedForType("voice", def("group", "group", []))).toBe(true);
    expect(definitionAllowedForType("voice", def("decoration_background", "decoration", []))).toBe(true);
  });

  it("derives the workflow type from its trigger", () => {
    expect(workflowTypeOfTrigger("trigger_call_received")).toBe("voice");
    expect(workflowTypeOfTrigger("trigger_first_message")).toBe("messages");
    expect(workflowTypeOfTriggerDefinition(def("trigger_call_received", "trigger", ["voice"]))).toBe("voice");
    expect(workflowTypeOfTriggerDefinition(def("trigger_webhook", "trigger", ["whatsapp"]))).toBe("messages");
    expect(workflowTypeOfTriggerDefinition(def("action_play_audio", "action", ["voice"]))).toBeNull();
  });
});
