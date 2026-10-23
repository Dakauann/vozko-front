import { describe, expect, it } from "vitest";

import { automationAccount, inboxSettingsOf, withInboxChange } from "@/lib/carrier-messaging/automation";
import { automationFixture } from "@/lib/carrier-messaging/test-fixtures";
import { senderFixture } from "@/lib/rcs/test-fixtures";

const settings = { department_id: "dep-1", pipeline_id: null, automation: { ...automationFixture(), agent_id: "ag-1", disclosure: "Sou um assistente." } };

describe("carrier inbox settings adapter", () => {
  it("shows the backend settings in the shape the shared panel reads", () => {
    expect(automationAccount("snd-1", { ...settings, pipeline_id: "pl-1" })).toEqual({
      id: "snd-1",
      agentId: "ag-1",
      workflowId: null,
      pipelineId: "pl-1",
      enableAgentResponses: false,
      enableWorkflow: false,
      enableAnalysis: true,
      enableAutoStaging: false,
      enableAutoMemory: false,
    });
  });

  it("turns one panel change into the full body the PUT replaces", () => {
    expect(withInboxChange(settings, { enableAgentResponses: true })).toEqual({ ...settings, automation: { ...settings.automation, enable_agent_responses: true } });
    expect(withInboxChange(settings, { pipelineId: "pl-2" })).toEqual({ ...settings, pipeline_id: "pl-2" });
    expect(withInboxChange({ ...settings, pipeline_id: "pl-2" }, { pipelineId: "" })).toEqual(settings);
    expect(withInboxChange(settings, {})).toEqual(settings);
  });

  it("takes only the inbox fields from a sender", () => {
    const sender = senderFixture({ department_id: "dep-9", pipeline_id: "pl-9" });
    expect(inboxSettingsOf(sender)).toEqual({ department_id: "dep-9", pipeline_id: "pl-9", automation: sender.automation });
  });
});
