export const NOTIFICATION_CATEGORIES = [
  "announcements",
  "campaigns",
  "templates",
  "channels",
  "billing",
  "advertising",
  "team",
  "support",
  "system",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_SEVERITIES = ["info", "success", "warning", "critical"] as const;

export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
  readAt?: string | null;
}

export interface NotificationPage {
  items: NotificationItem[];
  next: string;
}

export interface NotificationSummary {
  unread: number;
  byCategory: Partial<Record<NotificationCategory, number>>;
  capped: boolean;
}

export interface NotificationPreferences {
  categories: NotificationCategory[];
  emailMuted: NotificationCategory[];
  emailDigest: boolean;
}

export type NotificationPreferenceChoice = Pick<NotificationPreferences, "emailMuted" | "emailDigest">;

export interface NotificationCreatedEvent {
  workspaceId: string;
  item: NotificationItem;
}

const BADGE_CEILING = 99;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

export function isNotificationCategory(value: unknown): value is NotificationCategory {
  return typeof value === "string" && (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

export function isNotificationSeverity(value: unknown): value is NotificationSeverity {
  return typeof value === "string" && (NOTIFICATION_SEVERITIES as readonly string[]).includes(value);
}

export function isNotificationItem(value: unknown): value is NotificationItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    isNotificationCategory(value.category) &&
    isNotificationSeverity(value.severity) &&
    typeof value.title === "string" &&
    typeof value.body === "string" &&
    typeof value.createdAt === "string" &&
    isOptionalString(value.imageUrl) &&
    isOptionalString(value.actionUrl) &&
    isOptionalString(value.actionLabel) &&
    (value.readAt === null || isOptionalString(value.readAt))
  );
}

export function isNotificationPage(value: unknown): value is NotificationPage {
  if (!isRecord(value) || !Array.isArray(value.items)) return false;
  return value.items.every(isNotificationItem) && isOptionalString(value.next);
}

export function isNotificationSummary(value: unknown): value is NotificationSummary {
  if (!isRecord(value) || !isRecord(value.byCategory)) return false;
  return (
    typeof value.unread === "number" &&
    typeof value.capped === "boolean" &&
    Object.values(value.byCategory).every((count) => typeof count === "number")
  );
}

export function isNotificationPreferences(value: unknown): value is NotificationPreferences {
  if (!isRecord(value) || !Array.isArray(value.categories) || !Array.isArray(value.emailMuted)) return false;
  return value.categories.every(isNotificationCategory) && value.emailMuted.every(isNotificationCategory) && typeof value.emailDigest === "boolean";
}

export function isNotificationCreatedEvent(value: unknown): value is NotificationCreatedEvent {
  return isRecord(value) && typeof value.workspaceId === "string" && isNotificationItem(value.item);
}

export function unreadBadgeLabel(unread: number, capped: boolean): string | null {
  if (unread <= 0) return null;
  if (capped || unread > BADGE_CEILING) return `${BADGE_CEILING}+`;
  return String(unread);
}
