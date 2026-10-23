import { apiClient, type ApiResult } from "@/lib/api/browser-client";
import { requireSectionData } from "@/lib/analytics/section-query";
import type {
  Campaign,
  CampaignListQuery,
  CampaignRequest,
  CampaignSummary,
  Design,
  DesignRequest,
  DomainStat,
  ImportResult,
  ImportRow,
  ItemList,
  LinkStat,
  Metrics,
  Page,
  Preview,
  Recipient,
  RecipientQuery,
  RenderRequest,
  Review,
  Sender,
  StarterList,
  SubscribeRequest,
  Subscription,
  TestSendResponse,
  Timeline,
} from "@/lib/email-campaigns/types";

export interface EmailActionError {
  error: string;
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

export type EmailActionResult<T> = { data: T } | EmailActionError;

export function isEmailActionError<T>(result: EmailActionResult<T>): result is EmailActionError {
  return "error" in result;
}

const CAMPAIGNS = "/email/campaigns";
const DESIGNS = "/email/designs";

function campaignPath(id: string, section?: string): string {
  const base = `${CAMPAIGNS}/${encodeURIComponent(id)}`;
  return section ? `${base}/${section}` : base;
}

function designPath(id: string): string {
  return `${DESIGNS}/${encodeURIComponent(id)}`;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

function settle<T>(result: ApiResult<T>, empty?: T): EmailActionResult<T> {
  if (result.error) {
    return {
      error: result.error.message,
      ...(result.error.code ? { code: result.error.code } : {}),
      ...(result.error.status !== undefined ? { status: result.error.status } : {}),
      ...(result.error.details ? { details: result.error.details } : {}),
    };
  }
  if (result.data === undefined || result.data === null) {
    return empty === undefined ? { error: "Empty response" } : { data: empty };
  }
  return { data: result.data };
}

async function send<T>(path: string, method: string, body?: unknown, empty?: T): Promise<EmailActionResult<T>> {
  const result = await apiClient<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return settle(result, empty);
}

async function read<T>(path: string, what: string, signal?: AbortSignal): Promise<T> {
  return requireSectionData(await apiClient<T>(path, { method: "GET", signal }), what);
}

export function fetchEmailCampaigns(params: CampaignListQuery, signal?: AbortSignal) {
  const path = `${CAMPAIGNS}${query({ status: params.status, search: params.search?.trim(), page: params.page, page_size: params.pageSize })}`;
  return read<Page<CampaignSummary>>(path, "email campaigns", signal);
}

export function fetchEmailCampaign(id: string, signal?: AbortSignal) {
  return read<Campaign>(campaignPath(id), "email campaign", signal);
}

export function getEmailCampaignAction(id: string) {
  return send<Campaign>(campaignPath(id), "GET");
}

export function createEmailCampaignAction(request: CampaignRequest) {
  return send<Campaign>(CAMPAIGNS, "POST", request);
}

export function updateEmailCampaignAction(id: string, request: CampaignRequest) {
  return send<Campaign>(campaignPath(id), "PATCH", request);
}

export function deleteEmailCampaignAction(id: string) {
  return send<{ deleted: true }>(campaignPath(id), "DELETE", undefined, { deleted: true });
}

export function testSendEmailCampaignAction(id: string, to: string[]) {
  return send<TestSendResponse>(campaignPath(id, "test"), "POST", { to });
}

export function fetchEmailCampaignReview(id: string, signal?: AbortSignal) {
  return read<Review>(campaignPath(id, "review"), "email campaign review", signal);
}

export function launchEmailCampaignAction(id: string, scheduledAt?: string) {
  return send<Campaign>(campaignPath(id, "launch"), "POST", scheduledAt ? { scheduled_at: scheduledAt } : undefined);
}

export function readyEmailCampaignAction(id: string) {
  return send<Campaign>(campaignPath(id, "ready"), "POST");
}

export function unscheduleEmailCampaignAction(id: string) {
  return send<Campaign>(campaignPath(id, "unschedule"), "POST");
}

export function pauseEmailCampaignAction(id: string) {
  return send<Campaign>(campaignPath(id, "pause"), "POST");
}

export function resumeEmailCampaignAction(id: string) {
  return send<Campaign>(campaignPath(id, "resume"), "POST");
}

export function stopEmailCampaignAction(id: string) {
  return send<Campaign>(campaignPath(id, "stop"), "POST");
}

export function fetchEmailCampaignMetrics(id: string, signal?: AbortSignal) {
  return read<Metrics>(campaignPath(id, "metrics"), "email campaign metrics", signal);
}

export function fetchEmailCampaignTimeline(id: string, signal?: AbortSignal) {
  return read<Timeline>(campaignPath(id, "timeline"), "email campaign timeline", signal);
}

export function fetchEmailCampaignLinks(id: string, signal?: AbortSignal) {
  return read<ItemList<LinkStat>>(campaignPath(id, "links"), "email campaign links", signal);
}

export function fetchEmailCampaignDomains(id: string, signal?: AbortSignal) {
  return read<ItemList<DomainStat>>(campaignPath(id, "domains"), "email campaign domains", signal);
}

export function fetchEmailCampaignRecipients(id: string, params: RecipientQuery, signal?: AbortSignal) {
  const path = `${campaignPath(id, "recipients")}${query({
    status: params.status,
    skip_reason: params.skipReason,
    variant: params.variant,
    search: params.search?.trim(),
    page: params.page,
    page_size: params.pageSize,
  })}`;
  return read<Page<Recipient>>(path, "email campaign recipients", signal);
}

export function fetchEmailDesigns(params: { kind?: "template" | "campaign"; page?: number; pageSize?: number }, signal?: AbortSignal) {
  const path = `${DESIGNS}${query({ kind: params.kind, page: params.page, page_size: params.pageSize })}`;
  return read<Page<Design>>(path, "email designs", signal);
}

export function fetchEmailDesign(id: string, signal?: AbortSignal) {
  return read<Design>(designPath(id), "email design", signal);
}

export function createEmailDesignAction(request: DesignRequest) {
  return send<Design>(DESIGNS, "POST", request);
}

export function updateEmailDesignAction(id: string, request: DesignRequest) {
  return send<Design>(designPath(id), "PUT", request);
}

export function deleteEmailDesignAction(id: string) {
  return send<{ deleted: true }>(designPath(id), "DELETE", undefined, { deleted: true });
}

export function fetchEmailStarters(signal?: AbortSignal) {
  return read<StarterList>(`${DESIGNS}/starters`, "email starters", signal);
}

export function renderEmailAction(request: RenderRequest) {
  return send<Preview>("/email/render", "POST", request);
}

export function fetchEmailSenders(signal?: AbortSignal) {
  return read<Sender[]>("/email/senders", "email senders", signal);
}

export function subscribeEmailAddressAction(request: SubscribeRequest) {
  return send<Subscription>("/email/subscriptions", "POST", request);
}

export function importEmailSubscriptionsAction(rows: ImportRow[]) {
  return send<ImportResult>("/email/subscriptions/import", "POST", { rows });
}

export function unsubscribeEmailAddressAction(address: string) {
  return send<Subscription>("/email/subscriptions/unsubscribe", "POST", { address });
}
