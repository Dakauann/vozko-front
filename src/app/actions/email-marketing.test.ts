import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock("@/lib/api/browser-client", () => ({ apiClient: client.apiClient }));

import {
  addEmailSuppressionAction,
  adminGetEmailSendQuotaAction,
  adminListEmailAccountsAction,
  adminPauseEmailAccountAction,
  adminPromoteEmailAccountAction,
  adminReinstateEmailAccountAction,
  connectEmailDomainAction,
  createEmailSenderAction,
  deleteEmailSenderAction,
  getEmailDomainAction,
  getEmailOverviewAction,
  getEmailPricingAction,
  getEmailSetupAction,
  listEmailSendersAction,
  listEmailSuppressionsAction,
  provisionEmailAction,
  changeEmailSubdomainAction,
  checkEmailSubdomainAction,
  recheckEmailDomainAction,
  removeEmailDomainAction,
  removeEmailSuppressionAction,
  updateEmailSenderAction,
} from "@/app/actions/email-marketing";

beforeEach(() => {
  client.apiClient.mockReset();
  client.apiClient.mockResolvedValue({ data: { ok: true } });
});

function lastCall() {
  return client.apiClient.mock.calls.at(-1);
}

describe("email marketing actions", () => {
  it("reads the setup, pricing and overview", async () => {
    expect(await getEmailSetupAction()).toEqual({ data: { ok: true } });
    expect(lastCall()).toEqual(["/email/setup", { method: "GET", signal: undefined }]);
    await getEmailPricingAction();
    expect(lastCall()?.[0]).toBe("/email/pricing");
    await getEmailOverviewAction(90);
    expect(lastCall()?.[0]).toBe("/email/overview?days=90");
  });

  it("provisions without a body", async () => {
    await provisionEmailAction();
    expect(lastCall()).toEqual(["/email/setup/provision", { method: "POST" }]);
  });

  it("activates with the chosen subdomain, checks a name and changes it", async () => {
    await provisionEmailAction("cartaodetodososasco");
    expect(lastCall()).toEqual(["/email/setup/provision", { method: "POST", body: JSON.stringify({ slug: "cartaodetodososasco" }) }]);
    await checkEmailSubdomainAction("loja & cia");
    expect(lastCall()).toEqual(["/email/setup/subdomain/check?slug=loja%20%26%20cia", { method: "GET", signal: undefined }]);
    await changeEmailSubdomainAction("nova");
    expect(lastCall()).toEqual(["/email/setup/subdomain", { method: "PUT", body: JSON.stringify({ slug: "nova" }) }]);
  });

  it("connects, reads, rechecks and removes domains", async () => {
    await connectEmailDomainAction("acme.com.br");
    expect(lastCall()).toEqual(["/email/domains", { method: "POST", body: JSON.stringify({ domain: "acme.com.br" }) }]);
    await getEmailDomainAction("d 1");
    expect(lastCall()?.[0]).toBe("/email/domains/d%201");
    await recheckEmailDomainAction("d-1");
    expect(lastCall()).toEqual(["/email/domains/d-1/recheck", { method: "POST" }]);
    client.apiClient.mockResolvedValueOnce({});
    expect(await removeEmailDomainAction("d-1")).toEqual({ data: true });
    expect(lastCall()).toEqual(["/email/domains/d-1", { method: "DELETE" }]);
  });

  it("lists, creates, patches and deletes senders", async () => {
    await listEmailSendersAction();
    expect(lastCall()?.[0]).toBe("/email/senders");
    const input = { domain_id: "d-1", local_part: "contato", display_name: "Acme", reply_forward_to: "", is_default: true };
    await createEmailSenderAction(input);
    expect(lastCall()).toEqual(["/email/senders", { method: "POST", body: JSON.stringify(input) }]);
    await updateEmailSenderAction("s-1", { is_default: true });
    expect(lastCall()).toEqual(["/email/senders/s-1", { method: "PATCH", body: JSON.stringify({ is_default: true }) }]);
    client.apiClient.mockResolvedValueOnce({});
    expect(await deleteEmailSenderAction("s-1")).toEqual({ data: true });
  });

  it("pages, adds and removes suppressions with the address encoded", async () => {
    await listEmailSuppressionsAction(2, 20, "");
    expect(lastCall()?.[0]).toBe("/email/suppressions?page=2&pageSize=20");
    await listEmailSuppressionsAction(1, 20, " Ana+1@ ");
    expect(lastCall()?.[0]).toBe("/email/suppressions?page=1&pageSize=20&q=Ana%2B1%40");
    await addEmailSuppressionAction("a@b.com");
    expect(lastCall()).toEqual(["/email/suppressions", { method: "POST", body: JSON.stringify({ address: "a@b.com" }) }]);
    client.apiClient.mockResolvedValueOnce({});
    await removeEmailSuppressionAction("a+b@c.com");
    expect(lastCall()).toEqual(["/email/suppressions/a%2Bb%40c.com", { method: "DELETE" }]);
  });

  it("drives the admin accounts", async () => {
    await adminListEmailAccountsAction(1, 20);
    expect(lastCall()?.[0]).toBe("/admin/email/accounts?page=1&pageSize=20");
    await adminPauseEmailAccountAction("ws-1", "abuse");
    expect(lastCall()).toEqual(["/admin/email/accounts/ws-1/pause", { method: "POST", body: JSON.stringify({ reason: "abuse" }) }]);
    await adminReinstateEmailAccountAction("ws-1");
    expect(lastCall()).toEqual(["/admin/email/accounts/ws-1/reinstate", { method: "POST" }]);
    await adminPromoteEmailAccountAction("ws-1");
    expect(lastCall()).toEqual(["/admin/email/accounts/ws-1/promote", { method: "POST" }]);
    await adminGetEmailSendQuotaAction();
    expect(lastCall()?.[0]).toBe("/admin/email/quota");
  });

  it("keeps the refusal code and status", async () => {
    client.apiClient.mockResolvedValueOnce({ error: { message: "raw", code: "email_domain_taken", status: 409 } });
    expect(await connectEmailDomainAction("acme.com.br")).toEqual({ error: "raw", code: "email_domain_taken", status: 409, expected: undefined });
  });
});
