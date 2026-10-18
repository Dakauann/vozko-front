import { isActionError, type ActionResult } from "@/app/actions/action-result";
import { getChecked, sendChecked } from "@/app/actions/checked-request";
import {
  isBroadcast,
  isBroadcastPage,
  isBroadcastReach,
  isBroadcastRecipientPage,
  type Broadcast,
  type BroadcastPage,
  type BroadcastReach,
  type BroadcastRecipientPage,
  type BroadcastRecipientStatus,
  type BroadcastRequest,
} from "@/lib/notifications/broadcast";

export interface NotificationImage {
  url: string;
}

export interface BroadcastListQuery {
  cursor?: string;
  limit?: number;
}

export interface BroadcastRecipientQuery extends BroadcastListQuery {
  status: BroadcastRecipientStatus;
}

const BROADCASTS_PATH = "/admin/notifications/broadcasts";

function isNotificationImage(value: unknown): value is NotificationImage {
  return typeof value === "object" && value !== null && typeof (value as NotificationImage).url === "string" && (value as NotificationImage).url !== "";
}

function withQuery(path: string, params: URLSearchParams, query: BroadcastListQuery): string {
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

function recipientsPath(broadcastId: string, query: BroadcastRecipientQuery): string {
  return withQuery(`${BROADCASTS_PATH}/${encodeURIComponent(broadcastId)}/recipients`, new URLSearchParams({ status: query.status }), query);
}

export async function uploadNotificationImageAction(file: File): Promise<ActionResult<NotificationImage>> {
  const form = new FormData();
  form.append("file", file);
  return sendChecked("/admin/notifications/images", "POST", form, isNotificationImage, "notification image");
}

export async function createNotificationBroadcastAction(request: BroadcastRequest): Promise<ActionResult<Broadcast>> {
  return sendChecked(BROADCASTS_PATH, "POST", request, isBroadcast, "notification broadcast");
}

export async function previewNotificationBroadcastAction(request: BroadcastRequest, signal?: AbortSignal): Promise<ActionResult<BroadcastReach>> {
  return sendChecked(`${BROADCASTS_PATH}/preview`, "POST", request, isBroadcastReach, "notification broadcast reach", signal);
}

export async function listNotificationBroadcastsAction(query: BroadcastListQuery, signal?: AbortSignal): Promise<ActionResult<BroadcastPage>> {
  const result = await getChecked(withQuery(BROADCASTS_PATH, new URLSearchParams(), query), isBroadcastPage, "notification broadcasts", signal);
  if (isActionError(result)) return result;
  return { data: { items: result.data.items, next: result.data.next ?? "" } };
}

export async function listBroadcastRecipientsAction(
  broadcastId: string,
  query: BroadcastRecipientQuery,
  signal?: AbortSignal,
): Promise<ActionResult<BroadcastRecipientPage>> {
  const result = await getChecked(recipientsPath(broadcastId, query), isBroadcastRecipientPage, "broadcast recipients", signal);
  if (isActionError(result)) return result;
  return { data: { items: result.data.items, next: result.data.next ?? "" } };
}
