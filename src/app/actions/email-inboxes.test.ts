import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock("@/lib/api/browser-client", () => ({ apiClient: client.apiClient }));

import { getEmailInboxAction, listEmailInboxesAction, updateEmailInboxAction } from "@/app/actions/email-inboxes";

const SETTINGS = {
  departmentId: "dep-1",
  agentId: "ag-1",
  enableAgentResponses: true,
  enableWorkflow: false,
  enableAnalysis: true,
  enableAutoStaging: false,
  enableAutoMemory: true,
};

beforeEach(() => {
  client.apiClient.mockReset();
});

describe("email inbox actions", () => {
  it("lists the inboxes", async () => {
    client.apiClient.mockResolvedValue({ data: { items: [{ id: "snd-1" }] } });
    expect(await listEmailInboxesAction()).toEqual({ inboxes: [{ id: "snd-1" }] });
    expect(client.apiClient).toHaveBeenCalledWith("/email/inboxes", { method: "GET" });
  });

  it("reports a list failure with its code and keeps an empty list", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "nope", code: "forbidden" } });
    expect(await listEmailInboxesAction()).toEqual({ inboxes: [], error: "nope", code: "forbidden" });
  });

  it("loads one inbox by its sender id", async () => {
    client.apiClient.mockResolvedValue({ data: { id: "snd 1" } });
    expect(await getEmailInboxAction("snd 1")).toEqual({ inbox: { id: "snd 1" } });
    expect(client.apiClient).toHaveBeenCalledWith("/email/inboxes/snd%201", { method: "GET" });
  });

  it("puts the settings as they are", async () => {
    client.apiClient.mockResolvedValue({ data: { id: "snd-1" } });
    expect(await updateEmailInboxAction("snd-1", SETTINGS)).toEqual({ inbox: { id: "snd-1" } });
    expect(client.apiClient).toHaveBeenCalledWith("/email/inboxes/snd-1", { method: "PUT", body: JSON.stringify(SETTINGS) });
  });

  it("reports an update failure", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "bad", code: "invalid_agent" } });
    expect(await updateEmailInboxAction("snd-1", SETTINGS)).toEqual({ error: "bad", code: "invalid_agent" });
  });
});
