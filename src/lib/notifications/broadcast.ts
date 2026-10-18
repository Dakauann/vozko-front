import {
  isNotificationCategory,
  isNotificationSeverity,
  type NotificationCategory,
  type NotificationItem,
  type NotificationSeverity,
} from "./types";

export const NOTIFICATION_LIMITS = {
  title: 120,
  body: 2000,
  actionLabel: 40,
  imageBytes: 5 * 1024 * 1024,
} as const;

export const NOTIFICATION_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export const BROADCAST_AUDIENCES = ["everyone", "managers", "users"] as const;

export type BroadcastAudienceKind = (typeof BROADCAST_AUDIENCES)[number];

export type BroadcastStatus = "queued" | "completed";

export type NotificationProblemCode =
  | "notification_target_invalid"
  | "notification_audience_invalid"
  | "notification_title_required"
  | "notification_title_too_long"
  | "notification_body_too_long"
  | "notification_action_url_invalid"
  | "notification_action_label_too_long"
  | "notification_image_empty"
  | "notification_image_too_large"
  | "notification_image_type";

export interface BroadcastForm {
  allWorkspaces: boolean;
  workspaceIds: string[];
  audience: BroadcastAudienceKind;
  userIds: string[];
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  imageUrl: string;
  actionUrl: string;
  actionLabel: string;
  email: boolean;
}

export const BROADCAST_FORM_DEFAULTS: BroadcastForm = {
  allWorkspaces: false,
  workspaceIds: [],
  audience: "everyone",
  userIds: [],
  category: "announcements",
  severity: "info",
  title: "",
  body: "",
  imageUrl: "",
  actionUrl: "",
  actionLabel: "",
  email: false,
};

export interface BroadcastRequest {
  target: { all: boolean; workspaceIds: string[] };
  audience: { kind: BroadcastAudienceKind; userIds?: string[] };
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
  email: boolean;
}

export interface Broadcast {
  id: string;
  target: { all: boolean; workspaceIds?: string[] };
  audience: { kind: string; userIds?: string[] };
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
  email?: boolean;
  status?: BroadcastStatus | string;
  workspaceCount?: number;
  createdBy?: string;
  createdAt: string;
  completedAt?: string | null;
  recipients?: number;
  read?: number;
}

export interface BroadcastPage {
  items: Broadcast[];
  next: string;
}

export interface BroadcastReach {
  workspaces: number;
  recipients: number;
  people: number;
  emails: number;
}

export const BROADCAST_RECIPIENT_STATUSES = ["all", "read", "unread"] as const;

export type BroadcastRecipientStatus = (typeof BROADCAST_RECIPIENT_STATUSES)[number];

export interface BroadcastRecipient {
  userId: string;
  name: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  readAt?: string | null;
}

export interface BroadcastRecipientPage {
  items: BroadcastRecipient[];
  next: string;
}

export type ActionLinkKind = "internal" | "external";

const UNSAFE_LINK_CHARACTERS = /[\s\\]/;
const EXTERNAL_PREFIX = "https://";

export function actionLinkKind(link: string): ActionLinkKind | null {
  if (link === "" || UNSAFE_LINK_CHARACTERS.test(link)) return null;
  if (link.startsWith("/")) return link.startsWith("//") ? null : "internal";
  if (!link.startsWith(EXTERNAL_PREFIX)) return null;
  const rest = link.slice(EXTERNAL_PREFIX.length);
  return rest !== "" && !rest.startsWith("/") ? "external" : null;
}

function runeCount(text: string): number {
  return [...text].length;
}

export function imageFileProblem(file: { type: string; size: number }): NotificationProblemCode | null {
  if (file.size <= 0) return "notification_image_empty";
  if (file.size > NOTIFICATION_LIMITS.imageBytes) return "notification_image_too_large";
  if (!(NOTIFICATION_IMAGE_TYPES as readonly string[]).includes(file.type)) return "notification_image_type";
  return null;
}

export function usersAudienceAvailable(form: Pick<BroadcastForm, "allWorkspaces" | "workspaceIds">): boolean {
  return !form.allWorkspaces && form.workspaceIds.length === 1;
}

function targetProblem(form: BroadcastForm): NotificationProblemCode | null {
  return form.allWorkspaces || form.workspaceIds.length > 0 ? null : "notification_target_invalid";
}

function audienceProblem(form: BroadcastForm): NotificationProblemCode | null {
  if (form.audience !== "users") return null;
  return usersAudienceAvailable(form) && form.userIds.length > 0 ? null : "notification_audience_invalid";
}

function titleProblem(title: string): NotificationProblemCode | null {
  if (title === "") return "notification_title_required";
  return runeCount(title) > NOTIFICATION_LIMITS.title ? "notification_title_too_long" : null;
}

function actionProblem(actionUrl: string, actionLabel: string): NotificationProblemCode | null {
  if (actionUrl === "") return actionLabel === "" ? null : "notification_action_url_invalid";
  if (actionLinkKind(actionUrl) === null) return "notification_action_url_invalid";
  return runeCount(actionLabel) > NOTIFICATION_LIMITS.actionLabel ? "notification_action_label_too_long" : null;
}

export function broadcastProblems(form: BroadcastForm): NotificationProblemCode[] {
  const problems = [
    targetProblem(form),
    audienceProblem(form),
    titleProblem(form.title.trim()),
    runeCount(form.body.trim()) > NOTIFICATION_LIMITS.body ? "notification_body_too_long" : null,
    actionProblem(form.actionUrl.trim(), form.actionLabel.trim()),
  ];
  return problems.filter((problem): problem is NotificationProblemCode => problem !== null);
}

function optionalText<K extends string>(key: K, value: string): Partial<Record<K, string>> {
  const trimmed = value.trim();
  return trimmed === "" ? {} : ({ [key]: trimmed } as Record<K, string>);
}

export function broadcastRequest(form: BroadcastForm): BroadcastRequest {
  return {
    target: { all: form.allWorkspaces, workspaceIds: form.allWorkspaces ? [] : form.workspaceIds },
    audience: form.audience === "users" ? { kind: "users", userIds: form.userIds } : { kind: form.audience },
    category: form.category,
    severity: form.severity,
    title: form.title.trim(),
    body: form.body.trim(),
    ...optionalText("imageUrl", form.imageUrl),
    ...optionalText("actionUrl", form.actionUrl),
    ...optionalText("actionLabel", form.actionLabel),
    email: form.email,
  };
}

export function broadcastReachKey(request: BroadcastRequest): string {
  return JSON.stringify([request.target, request.audience, request.category, request.severity, request.email]);
}

export function broadcastReadShare(broadcast: Pick<Broadcast, "recipients" | "read">): number | null {
  if (!broadcast.recipients) return null;
  return (broadcast.read ?? 0) / broadcast.recipients;
}

export function broadcastPreviewItem(form: BroadcastForm, createdAt: string): NotificationItem {
  return {
    id: "preview",
    category: form.category,
    severity: form.severity,
    title: form.title.trim(),
    body: form.body.trim(),
    ...optionalText("imageUrl", form.imageUrl),
    ...optionalText("actionUrl", form.actionUrl),
    ...optionalText("actionLabel", form.actionLabel),
    createdAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === "number";
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

export function isBroadcast(value: unknown): value is Broadcast {
  if (!isRecord(value) || !isRecord(value.target) || !isRecord(value.audience)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.target.all === "boolean" &&
    typeof value.audience.kind === "string" &&
    isNotificationCategory(value.category) &&
    isNotificationSeverity(value.severity) &&
    typeof value.title === "string" &&
    typeof value.createdAt === "string" &&
    isOptionalNumber(value.recipients) &&
    isOptionalNumber(value.read)
  );
}

export function isBroadcastPage(value: unknown): value is BroadcastPage {
  return isRecord(value) && Array.isArray(value.items) && value.items.every(isBroadcast) && isOptionalString(value.next);
}

export function isBroadcastReach(value: unknown): value is BroadcastReach {
  if (!isRecord(value)) return false;
  return [value.workspaces, value.recipients, value.people, value.emails].every((count) => typeof count === "number");
}

function isBroadcastRecipient(value: unknown): value is BroadcastRecipient {
  if (!isRecord(value)) return false;
  return (
    [value.userId, value.name, value.email, value.workspaceId, value.workspaceName].every((text) => typeof text === "string") &&
    (value.readAt === null || isOptionalString(value.readAt))
  );
}

export function isBroadcastRecipientPage(value: unknown): value is BroadcastRecipientPage {
  return isRecord(value) && Array.isArray(value.items) && value.items.every(isBroadcastRecipient) && isOptionalString(value.next);
}
