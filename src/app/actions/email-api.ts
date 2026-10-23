import { settleResult, type ActionResult } from "@/app/actions/action-result";
import { apiClient } from "@/lib/api/browser-client";
import type {
  EmailLogDetail,
  EmailLogFilters,
  EmailLogPage,
  EmailWebhookDelivery,
  EmailWebhookDeliveryPage,
  EmailWebhookEndpoint,
  EmailWebhookEndpointWithSecret,
  EmailWebhookInput,
  EmailWebhookList,
} from "@/lib/email-api/types";

const DONE = true as const;
const LOG_PAGE_SIZE = 50;

function id(value: string): string {
  return encodeURIComponent(value);
}

export function emailLogQuery(filters: EmailLogFilters, cursor: string): string {
  const params = new URLSearchParams({ limit: String(LOG_PAGE_SIZE) });
  if (filters.status) params.set("status", filters.status);
  if (filters.recipient.trim()) params.set("recipient", filters.recipient.trim());
  if (filters.tagName.trim() && filters.tagValue.trim()) {
    params.set("tag_name", filters.tagName.trim());
    params.set("tag_value", filters.tagValue.trim());
  }
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

export async function listEmailLogAction(filters: EmailLogFilters, cursor: string, signal?: AbortSignal): Promise<ActionResult<EmailLogPage>> {
  return settleResult(await apiClient<EmailLogPage>(`/email/transactional/log?${emailLogQuery(filters, cursor)}`, { method: "GET", signal }));
}

export async function getEmailLogEntryAction(messageId: string, signal?: AbortSignal): Promise<ActionResult<EmailLogDetail>> {
  return settleResult(await apiClient<EmailLogDetail>(`/email/transactional/log/${id(messageId)}`, { method: "GET", signal }));
}

export async function listEmailWebhooksAction(signal?: AbortSignal): Promise<ActionResult<EmailWebhookList>> {
  return settleResult(await apiClient<EmailWebhookList>("/email/transactional/webhooks", { method: "GET", signal }));
}

export async function createEmailWebhookAction(input: EmailWebhookInput): Promise<ActionResult<EmailWebhookEndpointWithSecret>> {
  return settleResult(await apiClient<EmailWebhookEndpointWithSecret>("/email/transactional/webhooks", { method: "POST", body: JSON.stringify(input) }));
}

export async function updateEmailWebhookAction(endpointId: string, input: Partial<EmailWebhookInput>): Promise<ActionResult<EmailWebhookEndpoint>> {
  return settleResult(await apiClient<EmailWebhookEndpoint>(`/email/transactional/webhooks/${id(endpointId)}`, { method: "PATCH", body: JSON.stringify(input) }));
}

export async function deleteEmailWebhookAction(endpointId: string): Promise<ActionResult<true>> {
  return settleResult<true>(await apiClient<true>(`/email/transactional/webhooks/${id(endpointId)}`, { method: "DELETE" }), DONE);
}

export async function rotateEmailWebhookSecretAction(endpointId: string): Promise<ActionResult<EmailWebhookEndpointWithSecret>> {
  return settleResult(await apiClient<EmailWebhookEndpointWithSecret>(`/email/transactional/webhooks/${id(endpointId)}/secret`, { method: "POST" }));
}

export async function listEmailWebhookDeliveriesAction(endpointId: string, cursor: string, signal?: AbortSignal): Promise<ActionResult<EmailWebhookDeliveryPage>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return settleResult(await apiClient<EmailWebhookDeliveryPage>(`/email/transactional/webhooks/${id(endpointId)}/deliveries${query}`, { method: "GET", signal }));
}

export async function retryEmailWebhookDeliveryAction(endpointId: string, deliveryId: string): Promise<ActionResult<EmailWebhookDelivery>> {
  return settleResult(await apiClient<EmailWebhookDelivery>(`/email/transactional/webhooks/${id(endpointId)}/deliveries/${id(deliveryId)}/retry`, { method: "POST" }));
}
