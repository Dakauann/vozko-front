import { parsedRequest } from "@/lib/api/parsed-request";
import { parseCarrierChannels } from "@/lib/carrier-messaging/channels";
import {
  parseButtonStats,
  parseCampaignFunnel,
  parseCampaignTimeline,
  parseCarrierStats,
  parseOverview,
  parseRecipientPage,
  parseVariantStats,
  RECIPIENTS_PAGE_LIMIT,
  type OverviewChannel,
  type OverviewDays,
  type TimelineBucket,
} from "@/lib/carrier-messaging/analytics";
import {
  parseCampaign,
  parseCampaignEstimate,
  parseCampaignPage,
  type CampaignChannel,
  type CampaignDraft,
  type CampaignStatus,
  type RecipientStatus,
} from "@/lib/carrier-messaging/campaigns";
import { parseCarrierMessage, parseCarrierSettings, parseSuppressionPage, type CarrierSettings, type TestSendRequest } from "@/lib/carrier-messaging/settings";
import { parseRcsSender, parseRcsSenderList } from "@/lib/rcs/parse";
import type { RcsPauseReason, RcsSenderStatus } from "@/lib/rcs/types";
import { parseSmsRoute, parseSmsRouteList } from "@/lib/sms/parse";

export type CampaignTransition = "duplicate" | "launch" | "ready" | "pause" | "resume" | "stop";

export type AdminPauseReason = Exclude<RcsPauseReason, "carrier">;

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
}

function campaignPath(campaignId: string): string {
  return `/carrier/campaigns/${encodeURIComponent(campaignId)}`;
}

export function getCarrierChannelsAction(signal?: AbortSignal) {
  return parsedRequest("/carrier/channels", { method: "GET", signal }, parseCarrierChannels);
}

export function getCarrierOverviewAction(days: OverviewDays, channel: OverviewChannel, signal?: AbortSignal) {
  return parsedRequest(`/carrier/overview${query({ days, channel })}`, { method: "GET", signal }, parseOverview);
}

export interface CampaignListQuery {
  channel?: CampaignChannel;
  status?: CampaignStatus;
  page: number;
  limit: number;
}

export function listCarrierCampaignsAction(list: CampaignListQuery, signal?: AbortSignal) {
  return parsedRequest(
    `/carrier/campaigns${query({ channel: list.channel, status: list.status, page: list.page, limit: list.limit })}`,
    { method: "GET", signal },
    parseCampaignPage,
  );
}

export function getCarrierCampaignAction(campaignId: string, signal?: AbortSignal) {
  return parsedRequest(campaignPath(campaignId), { method: "GET", signal }, parseCampaign);
}

export function createCarrierCampaignAction(draft: CampaignDraft) {
  return parsedRequest("/carrier/campaigns", { method: "POST", body: JSON.stringify(draft) }, parseCampaign);
}

export function updateCarrierCampaignAction(campaignId: string, draft: Partial<CampaignDraft>) {
  return parsedRequest(campaignPath(campaignId), { method: "PATCH", body: JSON.stringify(draft) }, parseCampaign);
}

export function deleteCarrierCampaignAction(campaignId: string) {
  return parsedRequest(campaignPath(campaignId), { method: "DELETE" }, () => true as const);
}

export function transitionCarrierCampaignAction(campaignId: string, transition: CampaignTransition) {
  return parsedRequest(`${campaignPath(campaignId)}/${transition}`, { method: "POST" }, parseCampaign);
}

export function estimateCarrierCampaignAction(campaignId: string, signal?: AbortSignal) {
  return parsedRequest(`${campaignPath(campaignId)}/estimate`, { method: "POST", signal }, parseCampaignEstimate);
}

export function testCarrierCampaignAction(campaignId: string, phone: string, variant: number) {
  return parsedRequest(`${campaignPath(campaignId)}/test`, { method: "POST", body: JSON.stringify({ phone, variant }) }, parseCarrierMessage);
}

export function getCampaignFunnelAction(campaignId: string, runId?: string, signal?: AbortSignal) {
  return parsedRequest(`${campaignPath(campaignId)}/funnel${query({ run_id: runId })}`, { method: "GET", signal }, parseCampaignFunnel);
}

export function getCampaignVariantsAction(campaignId: string, signal?: AbortSignal) {
  return parsedRequest(`${campaignPath(campaignId)}/variants`, { method: "GET", signal }, parseVariantStats);
}

export function getCampaignButtonsAction(campaignId: string, signal?: AbortSignal) {
  return parsedRequest(`${campaignPath(campaignId)}/buttons`, { method: "GET", signal }, parseButtonStats);
}

export function getCampaignCarriersAction(campaignId: string, signal?: AbortSignal) {
  return parsedRequest(`${campaignPath(campaignId)}/carriers`, { method: "GET", signal }, parseCarrierStats);
}

export function getCampaignTimelineAction(campaignId: string, bucket: TimelineBucket, signal?: AbortSignal) {
  return parsedRequest(`${campaignPath(campaignId)}/timeline${query({ bucket })}`, { method: "GET", signal }, parseCampaignTimeline);
}

export interface RecipientQuery {
  page: number;
  limit?: number;
  status?: RecipientStatus;
}

export function listCampaignRecipientsAction(campaignId: string, recipients: RecipientQuery, signal?: AbortSignal) {
  const limit = recipients.limit ?? RECIPIENTS_PAGE_LIMIT.default;
  return parsedRequest(`${campaignPath(campaignId)}/recipients${query({ status: recipients.status, page: recipients.page, limit })}`, { method: "GET", signal }, parseRecipientPage);
}

export function getCarrierSettingsAction(signal?: AbortSignal) {
  return parsedRequest("/carrier/settings", { method: "GET", signal }, parseCarrierSettings);
}

export function saveCarrierSettingsAction(settings: CarrierSettings) {
  return parsedRequest("/carrier/settings", { method: "PUT", body: JSON.stringify(settings) }, parseCarrierSettings);
}

export function listSuppressionsAction(limit: number, offset: number, signal?: AbortSignal) {
  return parsedRequest(`/carrier/suppressions${query({ limit, offset })}`, { method: "GET", signal }, parseSuppressionPage);
}

export function addSuppressionAction(phone: string) {
  return parsedRequest("/carrier/suppressions", { method: "POST", body: JSON.stringify({ phone }) }, () => true as const);
}

export function removeSuppressionAction(phone: string) {
  return parsedRequest(`/carrier/suppressions/${encodeURIComponent(phone)}`, { method: "DELETE" }, () => true as const);
}

export function sendCarrierTestAction(request: TestSendRequest) {
  return parsedRequest("/carrier/test-sends", { method: "POST", body: JSON.stringify(request) }, parseCarrierMessage);
}

export function adminListCarrierSendersAction(status?: RcsSenderStatus, signal?: AbortSignal) {
  return parsedRequest(`/admin/carrier/senders${query({ status })}`, { method: "GET", signal }, parseRcsSenderList);
}

export function adminPauseCarrierSenderAction(senderId: string, reason: AdminPauseReason) {
  return parsedRequest(`/admin/carrier/senders/${encodeURIComponent(senderId)}/pause`, { method: "POST", body: JSON.stringify({ reason }) }, parseRcsSender);
}

export function adminResumeCarrierSenderAction(senderId: string) {
  return parsedRequest(`/admin/carrier/senders/${encodeURIComponent(senderId)}/resume`, { method: "POST" }, parseRcsSender);
}

export function adminListSmsRoutesAction(signal?: AbortSignal) {
  return parsedRequest("/admin/carrier/sms/routes", { method: "GET", signal }, parseSmsRouteList);
}

export function adminAssignSmsNumberAction(routeId: string, number: string) {
  return parsedRequest(`/admin/carrier/sms/routes/${encodeURIComponent(routeId)}/number`, { method: "PUT", body: JSON.stringify({ number }) }, parseSmsRoute);
}

export function adminReleaseSmsNumberAction(routeId: string) {
  return parsedRequest(`/admin/carrier/sms/routes/${encodeURIComponent(routeId)}/number`, { method: "DELETE" }, parseSmsRoute);
}
