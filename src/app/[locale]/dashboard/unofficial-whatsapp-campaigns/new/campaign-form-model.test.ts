import { describe, expect, it } from "vitest";

import { campaignPayload, emptySeed, seedFromDraft, wizardRequest, type CampaignFormSeed, type UnofficialCampaignDraft } from "./campaign-form-model";

const PACING = { min: 3000, max: 12000 };

function payloadOf(seed: CampaignFormSeed, overrides: Partial<Parameters<typeof campaignPayload>[0]> = {}) {
  return campaignPayload({
    mode: "create",
    values: { ...seed.values, name: "  Natal  ", instanceId: "i-1", agentId: "a-1" },
    audience: seed.audience,
    message: { kind: "text", bodies: ["Oi /sair"] },
    responseMode: "agent",
    scheduleEnabled: false,
    contentLocked: false,
    pacing: seed.pacing,
    pickedGroups: [],
    recipients: { source: "leads", selection: { mode: "everyone", expectedCount: 10, fingerprint: "fp" } },
    seed: null,
    ...overrides,
  });
}

describe("campaign form model", () => {
  it("starts a new campaign on leads, or on groups when a link names groups", () => {
    expect(emptySeed(null, PACING).audience).toBe("leads");
    expect(emptySeed({ groupIds: [] }, PACING).audience).toBe("groups");
    expect(emptySeed(null, PACING).pacing).toEqual({ minMs: 3000, maxMs: 12000, dailyCap: 0 });
  });

  it("builds the create body of today for leads", () => {
    const payload = payloadOf(emptySeed(null, PACING));
    expect(payload).toMatchObject({ name: "Natal", instanceId: "i-1", agentId: "a-1", enableAgentResponses: true, targets: [], scheduledStart: null, audience: undefined });
    expect(payload.recipients).toEqual({ source: "leads", selection: { mode: "everyone", expectedCount: 10, fingerprint: "fp" } });
    expect(payload.seedOutcome).toBeUndefined();
  });

  it("sends groups as targets with no number, funnel or recipients", () => {
    const seed = emptySeed({ groupIds: [] }, PACING);
    const payload = payloadOf(seed, { pickedGroups: [{ id: "g", jid: "g@g.us", subject: "Grupo", origin: "managed", runningCampaigns: 0 }] });
    expect(payload).toMatchObject({ audience: "groups", instanceId: undefined, pipelineId: null, targets: [{ groupJid: "g@g.us", name: "Grupo" }] });
    expect(payload.recipients).toBeUndefined();
  });

  it("drops the schedule from the draft request and carries the deal funnel", () => {
    const request = wizardRequest({ ...payloadOf(emptySeed(null, PACING)), scheduledStart: "2030-01-01T10:00:00Z" }, "pipe-1");
    expect("scheduledStart" in request).toBe(false);
    expect(request.dealPipelineId).toBe("pipe-1");
    expect("dealPipelineId" in wizardRequest(payloadOf(emptySeed(null, PACING)), "")).toBe(false);
  });

  it("restores a draft into the same form state and step", () => {
    const draft: UnofficialCampaignDraft = {
      id: "d-1",
      channel: "unofficial_whatsapp",
      name: "Natal",
      createdBy: "u-1",
      createdAt: "",
      updatedAt: "",
      payload: {
        request: { ...payloadOf(emptySeed(null, PACING), { responseMode: "workflow" }), workflowId: "w-1", enableWorkflow: true, sendDelayMinMs: 9000, dealPipelineId: "pipe-2" },
        state: { step: "audience", responseMode: "workflow", pickedGroups: [], seed: { on: true, sentPercent: 30, failedPercent: 5 } },
      },
    };
    const { seed, step } = seedFromDraft(draft, PACING);
    expect(step).toBe("audience");
    expect(seed.values).toMatchObject({ name: "Natal", instanceId: "i-1", workflowId: "w-1", scheduledStart: null });
    expect(seed.responseMode).toBe("workflow");
    expect(seed.pacing.minMs).toBe(9000);
    expect(seed.dealPipelineId).toBe("pipe-2");
    expect(seed.seed).toEqual({ on: true, sentPercent: 30, failedPercent: 5 });
  });

  it("restores an empty draft on the setup step with its name", () => {
    const { seed, step } = seedFromDraft({ id: "d", channel: "unofficial_whatsapp", name: "Só nome", createdBy: "", createdAt: "", updatedAt: "", payload: {} }, PACING);
    expect(step).toBe("config");
    expect(seed.values.name).toBe("Só nome");
    expect(seed.audience).toBe("leads");
  });
});
