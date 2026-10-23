import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/browser-client", () => ({ apiClient }));

import {
  createEmailCampaignAction,
  deleteEmailCampaignAction,
  fetchEmailCampaignRecipients,
  fetchEmailCampaignReview,
  fetchEmailCampaigns,
  fetchEmailDesigns,
  fetchEmailSenders,
  importEmailSubscriptionsAction,
  isEmailActionError,
  launchEmailCampaignAction,
  pauseEmailCampaignAction,
  renderEmailAction,
  resumeEmailCampaignAction,
  stopEmailCampaignAction,
  testSendEmailCampaignAction,
  unscheduleEmailCampaignAction,
  readyEmailCampaignAction,
  updateEmailCampaignAction,
  updateEmailDesignAction,
} from "../email-campaigns";
import { campaignPollInterval, metricsPollInterval } from "@/hooks/use-email-campaigns";
import type { Document } from "@/lib/email-design/types";

const DOC: Document = { version: 1, settings: {}, blocks: [] };

function lastCall() {
  const [path, init] = apiClient.mock.calls.at(-1) as [string, RequestInit];
  return { path, method: init.method, body: init.body ? JSON.parse(String(init.body)) : undefined };
}

beforeEach(() => {
  apiClient.mockReset();
  apiClient.mockResolvedValue({ data: { id: "c1" } });
});

describe("email campaign actions", () => {
  it("lists campaigns with the backend query names", async () => {
    await fetchEmailCampaigns({ status: "running", search: "  black ", page: 2, pageSize: 20 });
    expect(lastCall()).toMatchObject({ path: "/email/campaigns?status=running&search=black&page=2&page_size=20", method: "GET" });
  });

  it("creates and updates drafts", async () => {
    await createEmailCampaignAction({ name: "Promo", subject: "Oi" });
    expect(lastCall()).toEqual({ path: "/email/campaigns", method: "POST", body: { name: "Promo", subject: "Oi" } });
    await updateEmailCampaignAction("c1", { name: "Promo", subject: "Oi", document: DOC });
    expect(lastCall()).toEqual({ path: "/email/campaigns/c1", method: "PATCH", body: { name: "Promo", subject: "Oi", document: DOC } });
  });

  it("treats a 204 delete as done", async () => {
    apiClient.mockResolvedValue({});
    const result = await deleteEmailCampaignAction("c1");
    expect(lastCall()).toMatchObject({ path: "/email/campaigns/c1", method: "DELETE" });
    expect(result).toEqual({ data: { deleted: true } });
  });

  it("sends tests and lifecycle commands to their routes", async () => {
    await testSendEmailCampaignAction("c1", ["a@b.com"]);
    expect(lastCall()).toEqual({ path: "/email/campaigns/c1/test", method: "POST", body: { to: ["a@b.com"] } });
    for (const [run, section] of [
      [pauseEmailCampaignAction, "pause"],
      [resumeEmailCampaignAction, "resume"],
      [stopEmailCampaignAction, "stop"],
      [unscheduleEmailCampaignAction, "unschedule"],
    [readyEmailCampaignAction, "ready"],
    ] as const) {
      await run("c1");
      expect(lastCall()).toEqual({ path: `/email/campaigns/c1/${section}`, method: "POST", body: undefined });
    }
  });

  it("launches now without a body and schedules with scheduled_at", async () => {
    await launchEmailCampaignAction("c1");
    expect(lastCall()).toEqual({ path: "/email/campaigns/c1/launch", method: "POST", body: undefined });
    await launchEmailCampaignAction("c1", "2026-10-22T12:00:00.000Z");
    expect(lastCall().body).toEqual({ scheduled_at: "2026-10-22T12:00:00.000Z" });
  });

  it("keeps the code and the details of a refusal", async () => {
    apiClient.mockResolvedValue({ error: { message: "blocked", status: 422, code: "email_campaign_blocked", details: { issues: [{ code: "sender_missing" }] } } });
    const result = await launchEmailCampaignAction("c1");
    expect(isEmailActionError(result)).toBe(true);
    expect(result).toEqual({ error: "blocked", status: 422, code: "email_campaign_blocked", details: { issues: [{ code: "sender_missing" }] } });
  });

  it("reads the review and throws coded section errors", async () => {
    apiClient.mockResolvedValue({ data: { audience: {} } });
    await fetchEmailCampaignReview("c1");
    expect(lastCall()).toMatchObject({ path: "/email/campaigns/c1/review", method: "GET" });
    apiClient.mockResolvedValue({ error: { message: "nope", status: 404, code: "email_campaign_not_found" } });
    await expect(fetchEmailCampaignReview("c1")).rejects.toMatchObject({ code: "email_campaign_not_found", status: 404 });
  });

  it("filters recipients with the backend names", async () => {
    await fetchEmailCampaignRecipients("c1", { status: "skipped", skipReason: "no_email", variant: "b", search: " ana ", page: 3, pageSize: 25 });
    expect(lastCall().path).toBe("/email/campaigns/c1/recipients?status=skipped&skip_reason=no_email&variant=b&search=ana&page=3&page_size=25");
  });

  it("works with designs, render, senders and consent", async () => {
    await fetchEmailDesigns({ kind: "template", pageSize: 60 });
    expect(lastCall().path).toBe("/email/designs?kind=template&page_size=60");
    await updateEmailDesignAction("d1", { name: "Boas-vindas", kind: "template", document: DOC });
    expect(lastCall()).toMatchObject({ path: "/email/designs/d1", method: "PUT" });
    await renderEmailAction({ document: DOC, subject: "Oi" });
    expect(lastCall()).toEqual({ path: "/email/render", method: "POST", body: { document: DOC, subject: "Oi" } });
    apiClient.mockResolvedValue({ data: [] });
    await expect(fetchEmailSenders()).resolves.toEqual([]);
    apiClient.mockResolvedValue({ data: { subscribed: 1 } });
    await importEmailSubscriptionsAction([{ address: "a@b.com", consented_at: "2026-10-01T00:00:00Z" }]);
    expect(lastCall()).toEqual({ path: "/email/subscriptions/import", method: "POST", body: { rows: [{ address: "a@b.com", consented_at: "2026-10-01T00:00:00Z" }] } });
  });
});

describe("polling", () => {
  it("polls while sending and not at all otherwise", () => {
    expect(campaignPollInterval("running")).toBe(15000);
    expect(campaignPollInterval("held")).toBe(15000);
    expect(campaignPollInterval("completed")).toBe(false);
    expect(campaignPollInterval("draft")).toBe(false);
    expect(campaignPollInterval(undefined)).toBe(false);
  });

  it("follows the refresh the backend asks for", () => {
    expect(metricsPollInterval({ refresh_after_seconds: 15 })).toBe(15000);
    expect(metricsPollInterval({ refresh_after_seconds: 0 })).toBe(false);
    expect(metricsPollInterval(undefined)).toBe(false);
  });
});
