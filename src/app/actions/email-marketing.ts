import { settleResult, type ActionResult } from "@/app/actions/action-result";
import { apiClient } from "@/lib/api/browser-client";
import type {
  CreateEmailSenderInput,
  EmailAccount,
  EmailAddressStatus,
  EmailAdminAccount,
  EmailDomain,
  EmailOverview,
  EmailOverviewDays,
  EmailPage,
  EmailPricing,
  EmailSendQuota,
  EmailSender,
  EmailSetup,
  EmailSubdomainCheck,
  EmailSuppression,
  UpdateEmailSenderInput,
} from "@/lib/email-marketing/types";

const DONE = true as const;

async function read<T>(path: string, signal?: AbortSignal): Promise<ActionResult<T>> {
  return settleResult(await apiClient<T>(path, { method: "GET", signal }));
}

async function write<T>(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<ActionResult<T>> {
  const init: RequestInit = body === undefined ? { method } : { method, body: JSON.stringify(body) };
  return settleResult(await apiClient<T>(path, init));
}

async function remove(path: string): Promise<ActionResult<true>> {
  return settleResult<true>(await apiClient<true>(path, { method: "DELETE" }), DONE);
}

function id(value: string): string {
  return encodeURIComponent(value);
}

function pageQuery(page: number, pageSize: number): string {
  return `?page=${page}&pageSize=${pageSize}`;
}

export function getEmailSetupAction(signal?: AbortSignal) {
  return read<EmailSetup>("/email/setup", signal);
}

export function provisionEmailAction(slug?: string) {
  return write<EmailSetup>("/email/setup/provision", "POST", slug === undefined ? undefined : { slug });
}

export function checkEmailSubdomainAction(slug: string, signal?: AbortSignal) {
  return read<EmailSubdomainCheck>(`/email/setup/subdomain/check?slug=${encodeURIComponent(slug)}`, signal);
}

export function changeEmailSubdomainAction(slug: string) {
  return write<EmailSetup>("/email/setup/subdomain", "PUT", { slug });
}

export function connectEmailDomainAction(domain: string) {
  return write<EmailDomain>("/email/domains", "POST", { domain });
}

export function getEmailDomainAction(domainId: string, signal?: AbortSignal) {
  return read<EmailDomain>(`/email/domains/${id(domainId)}`, signal);
}

export function recheckEmailDomainAction(domainId: string) {
  return write<EmailDomain>(`/email/domains/${id(domainId)}/recheck`, "POST");
}

export function removeEmailDomainAction(domainId: string) {
  return remove(`/email/domains/${id(domainId)}`);
}

export function listEmailSendersAction(signal?: AbortSignal) {
  return read<EmailSender[]>("/email/senders", signal);
}

export function createEmailSenderAction(input: CreateEmailSenderInput) {
  return write<EmailSender>("/email/senders", "POST", input);
}

export function updateEmailSenderAction(senderId: string, input: UpdateEmailSenderInput) {
  return write<EmailSender>(`/email/senders/${id(senderId)}`, "PATCH", input);
}

export function deleteEmailSenderAction(senderId: string) {
  return remove(`/email/senders/${id(senderId)}`);
}

export function listEmailSuppressionsAction(page: number, pageSize: number, search: string, signal?: AbortSignal) {
  const q = search.trim();
  const filter = q ? `&q=${encodeURIComponent(q)}` : "";
  return read<EmailPage<EmailSuppression>>(`/email/suppressions${pageQuery(page, pageSize)}${filter}`, signal);
}

export function getEmailAddressStatusAction(address: string, signal?: AbortSignal) {
  return read<EmailAddressStatus>(`/email/address-status?address=${encodeURIComponent(address)}`, signal);
}

export function addEmailSuppressionAction(address: string) {
  return write<EmailSuppression>("/email/suppressions", "POST", { address });
}

export function removeEmailSuppressionAction(address: string) {
  return remove(`/email/suppressions/${id(address)}`);
}

export function getEmailPricingAction(signal?: AbortSignal) {
  return read<EmailPricing>("/email/pricing", signal);
}

export function getEmailOverviewAction(days: EmailOverviewDays, signal?: AbortSignal) {
  return read<EmailOverview>(`/email/overview?days=${days}`, signal);
}

export function adminListEmailAccountsAction(page: number, pageSize: number, signal?: AbortSignal) {
  return read<EmailPage<EmailAdminAccount>>(`/admin/email/accounts${pageQuery(page, pageSize)}`, signal);
}

export function adminGetEmailSendQuotaAction(signal?: AbortSignal) {
  return read<EmailSendQuota>("/admin/email/quota", signal);
}

export function adminPauseEmailAccountAction(workspaceId: string, reason: string) {
  return write<EmailAccount>(`/admin/email/accounts/${id(workspaceId)}/pause`, "POST", { reason });
}

export function adminReinstateEmailAccountAction(workspaceId: string) {
  return write<EmailAccount>(`/admin/email/accounts/${id(workspaceId)}/reinstate`, "POST");
}

export function adminPromoteEmailAccountAction(workspaceId: string) {
  return write<EmailAccount>(`/admin/email/accounts/${id(workspaceId)}/promote`, "POST");
}
