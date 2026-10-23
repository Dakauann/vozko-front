import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock("@/lib/api/browser-client", () => ({ apiClient: client.apiClient }));

import {
  addSuppressionAction,
  adminAssignSmsNumberAction,
  adminPauseCarrierSenderAction,
  estimateCarrierCampaignAction,
  getCampaignTimelineAction,
  getCarrierOverviewAction,
  listCampaignRecipientsAction,
  listCarrierCampaignsAction,
  listSuppressionsAction,
  removeSuppressionAction,
  saveCarrierSettingsAction,
  transitionCarrierCampaignAction,
} from "@/app/actions/carrier-messaging";
import { setRcsSenderInboxAction } from "@/app/actions/rcs";
import { createSmsRouteAction, deleteSmsRouteAction, setSmsRouteInboxAction, transitionSmsRouteAction } from "@/app/actions/sms";
import { automationFixture, settingsFixture } from "@/lib/carrier-messaging/test-fixtures";

beforeEach(() => {
  client.apiClient.mockReset();
  client.apiClient.mockResolvedValue({ data: {} });
});

function lastCall() {
  return client.apiClient.mock.calls.at(-1);
}

describe("carrier messaging action paths", () => {
  it("builds the overview and list queries", async () => {
    await getCarrierOverviewAction(30, "sms");
    expect(lastCall()?.[0]).toBe("/carrier/overview?days=30&channel=sms");
    await listCarrierCampaignsAction({ status: "running", page: 2, limit: 20 });
    expect(lastCall()?.[0]).toBe("/carrier/campaigns?status=running&page=2&limit=20");
  });

  it("drives the campaign lifecycle through its own routes", async () => {
    await transitionCarrierCampaignAction("c/1", "launch");
    expect(lastCall()).toEqual(["/carrier/campaigns/c%2F1/launch", { method: "POST" }]);
    await estimateCarrierCampaignAction("c1");
    expect(lastCall()?.[0]).toBe("/carrier/campaigns/c1/estimate");
  });

  it("reads analytics with their query", async () => {
    await getCampaignTimelineAction("c1", "hour");
    expect(lastCall()?.[0]).toBe("/carrier/campaigns/c1/timeline?bucket=hour");
    await listCampaignRecipientsAction("c1", { page: 3, status: "skipped" });
    expect(lastCall()?.[0]).toBe("/carrier/campaigns/c1/recipients?status=skipped&page=3&limit=50");
  });

  it("saves settings and manages suppressions", async () => {
    await saveCarrierSettingsAction(settingsFixture());
    expect(lastCall()).toEqual(["/carrier/settings", { method: "PUT", body: JSON.stringify(settingsFixture()) }]);
    await listSuppressionsAction(50, 100);
    expect(lastCall()?.[0]).toBe("/carrier/suppressions?limit=50&offset=100");
    const added = await addSuppressionAction("+5511999990000");
    expect(added).toEqual({ data: true, error: null });
    await removeSuppressionAction("+5511999990000");
    expect(lastCall()?.[0]).toBe("/carrier/suppressions/%2B5511999990000");
  });

  it("manages SMS routes", async () => {
    await createSmsRouteAction({ brand_prefix: "Sol" });
    expect(lastCall()).toEqual(["/sms/routes", { method: "POST", body: JSON.stringify({ brand_prefix: "Sol" }) }]);
    await transitionSmsRouteAction("rt-1", "pause");
    expect(lastCall()?.[0]).toBe("/sms/routes/rt-1/pause");
    await deleteSmsRouteAction("rt-1");
    expect(lastCall()).toEqual(["/sms/routes/rt-1", { method: "DELETE" }]);
  });

  it("saves the inbox settings of a sender and of a route", async () => {
    const settings = { department_id: "dep-1", pipeline_id: null, automation: automationFixture() };
    await setRcsSenderInboxAction("snd-1", settings);
    expect(lastCall()).toEqual(["/rcs/senders/snd-1/inbox", { method: "PUT", body: JSON.stringify(settings) }]);
    await setSmsRouteInboxAction("rt-1", settings);
    expect(lastCall()).toEqual(["/sms/routes/rt-1/inbox", { method: "PUT", body: JSON.stringify(settings) }]);
  });

  it("uses the admin routes", async () => {
    await adminPauseCarrierSenderAction("snd-1", "complaints");
    expect(lastCall()).toEqual(["/admin/carrier/senders/snd-1/pause", { method: "POST", body: JSON.stringify({ reason: "complaints" }) }]);
    await adminAssignSmsNumberAction("rt-1", "29090");
    expect(lastCall()).toEqual(["/admin/carrier/sms/routes/rt-1/number", { method: "PUT", body: JSON.stringify({ number: "29090" }) }]);
  });
});
