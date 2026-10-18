import { isActionError, type ActionResult } from "@/app/actions/action-result";
import { getChecked, sendChecked } from "@/app/actions/checked-request";
import {
  isNotificationPage,
  isNotificationPreferences,
  isNotificationSummary,
  type NotificationCategory,
  type NotificationPage,
  type NotificationPreferenceChoice,
  type NotificationPreferences,
  type NotificationSummary,
} from "@/lib/notifications/types";

export interface NotificationListQuery {
  category?: NotificationCategory;
  unread?: boolean;
  cursor?: string;
  limit?: number;
}

export interface NotificationChangeCount {
  updated: number;
}

function isChangeCount(value: unknown): value is NotificationChangeCount {
  return typeof value === "object" && value !== null && typeof (value as NotificationChangeCount).updated === "number";
}

function listPath(query: NotificationListQuery): string {
  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.unread) params.set("unread", "true");
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  const search = params.toString();
  return search ? `/notifications?${search}` : "/notifications";
}

export async function listNotificationsAction(query: NotificationListQuery, signal?: AbortSignal): Promise<ActionResult<NotificationPage>> {
  const result = await getChecked(listPath(query), isNotificationPage, "notification page", signal);
  if (isActionError(result)) return result;
  return { data: { items: result.data.items, next: result.data.next ?? "" } };
}

export async function getNotificationSummaryAction(signal?: AbortSignal): Promise<ActionResult<NotificationSummary>> {
  return getChecked("/notifications/summary", isNotificationSummary, "notification summary", signal);
}

export async function markNotificationsReadAction(ids: string[]): Promise<ActionResult<NotificationChangeCount>> {
  return sendChecked("/notifications/read", "POST", { ids }, isChangeCount, "notification read");
}

export async function markNotificationsUnreadAction(ids: string[]): Promise<ActionResult<NotificationChangeCount>> {
  return sendChecked("/notifications/unread", "POST", { ids }, isChangeCount, "notification unread");
}

export async function markAllNotificationsReadAction(category: NotificationCategory | null): Promise<ActionResult<NotificationChangeCount>> {
  return sendChecked("/notifications/read-all", "POST", category ? { category } : {}, isChangeCount, "notification read all");
}

export async function getNotificationPreferencesAction(signal?: AbortSignal): Promise<ActionResult<NotificationPreferences>> {
  return getChecked("/notifications/preferences", isNotificationPreferences, "notification preferences", signal);
}

export async function saveNotificationPreferencesAction(choice: NotificationPreferenceChoice): Promise<ActionResult<NotificationPreferences>> {
  const body = { emailMuted: choice.emailMuted, emailDigest: choice.emailDigest };
  return sendChecked("/notifications/preferences", "PUT", body, isNotificationPreferences, "notification preferences");
}
