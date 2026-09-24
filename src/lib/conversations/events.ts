
export type ConversationEventType =
  | "assigned"
  | "auto_assigned"
  | "unassigned"
  | "replied"
  | "reopened"
  | "tag_added"
  | "tag_removed"
  | "label_added"
  | "label_removed"
  | "ai_replied"
  | "ai_enabled"
  | "ai_disabled"
  | "ai_session_started"
  | "ai_session_ended"
  | "status_changed"
  | "stage_changed"
  | "finished"
  | "analysis_created"
  | "transfer_offered"
  | "transfer_accepted"
  | "transfer_declined"
  | "transfer_completed"
  | "transfer_failed"
  | "transfer_queued"
  | "queue_enqueued"
  | "queue_connected"
  | "queue_abandoned"
  | "queue_overflow"
  | "call_linked"
  | string;

export type ConversationActorKind = "human" | "ai" | "workflow" | "system" | string;

export interface ConversationEvent {
  id: string;
  workspace_id: string;
  entry_id: string;
  entry_type: string;
  event_type: ConversationEventType;
  actor_id: string;
  actor_kind?: ConversationActorKind;
  channel?: string;
  correlation_id?: string;
  details?: string;
  created_at: string;
  actor_name?: string;
  from_name?: string;
  to_name?: string;
}

export interface ConversationEventsPage {
  events: ConversationEvent[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export type ActivityFilter =
  | "all"
  | "human"
  | "ai"
  | "system"
  | "transfer";

const TRANSFER_OR_QUEUE = new Set([
  "transfer_offered",
  "transfer_accepted",
  "transfer_declined",
  "transfer_completed",
  "transfer_failed",
  "transfer_queued",
  "queue_enqueued",
  "queue_connected",
  "queue_abandoned",
  "queue_overflow",
  "call_linked",
]);

export function isTransferOrQueueEvent(type: string): boolean {
  return TRANSFER_OR_QUEUE.has(type);
}

export function normalizeActorKind(
  kind: string | undefined,
  actorId: string,
): ConversationActorKind {
  const k = (kind ?? "").toLowerCase();
  if (k === "human" || k === "ai" || k === "workflow" || k === "system") return k;
  if (actorId.startsWith("ai:")) return "ai";
  if (actorId.startsWith("workflow:")) return "workflow";
  if (actorId === "system" || actorId === "") return "system";
  return "human";
}

export function parseEventDetails(
  details: string | undefined,
): Record<string, string> {
  if (!details?.trim()) return {};
  try {
    const parsed = JSON.parse(details) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (value === null || value === undefined) continue;
      out[key] = String(value);
    }
    return out;
  } catch {
    return {};
  }
}

export function eventMatchesFilter(
  event: ConversationEvent,
  filter: ActivityFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "transfer") return isTransferOrQueueEvent(event.event_type);
  const kind = normalizeActorKind(event.actor_kind, event.actor_id);
  return kind === filter;
}


const FROM_ID_KEYS = [
  "from_user_id",
  "fromUserId",
  "from_actor_id",
  "previous_user_id",
  "previousUserId",
];

const TO_ID_KEYS = [
  "to_user_id",
  "toUserId",
  "assigned_user_id",
  "assignedUserId",
  "to_actor_id",
  "target",
];

const FROM_NAME_KEYS = ["from_username", "fromUsername", "from_user", "fromUser"];

const TO_NAME_KEYS = [
  "to_username",
  "toUsername",
  "to_user",
  "toUser",
  "assigned_to_name",
  "assignedToName",
  "assigned_to",
  "assignedTo",
  "target",
];

export const PARTICIPANT_DETAIL_KEYS = new Set([
  ...FROM_ID_KEYS,
  ...TO_ID_KEYS,
  ...FROM_NAME_KEYS,
  ...TO_NAME_KEYS,
]);

const HANDOFF_EVENTS = new Set([
  "assigned",
  "auto_assigned",
  "unassigned",
  "transfer_offered",
  "transfer_accepted",
  "transfer_declined",
  "transfer_completed",
  "transfer_failed",
  "transfer_queued",
  "queue_connected",
]);

export function isHandoffEvent(type: string): boolean {
  return HANDOFF_EVENTS.has(type);
}

const UUID_LIKE =
  /^(ai:|workflow:)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isDisplayableName(value: string | undefined | null): boolean {
  const v = (value ?? "").trim();
  if (!v) return false;
  if (UUID_LIKE.test(v)) return false;
  if (/^(ai|workflow):/i.test(v)) return false;
  if (/^[0-9a-f]{16,}$/i.test(v)) return false;
  return v !== "system";
}

function firstName(
  details: Record<string, string>,
  nameKeys: string[],
  idKeys: string[],
  memberNames: Record<string, string> | undefined,
): string | null {
  for (const key of nameKeys) {
    const v = details[key];
    if (isDisplayableName(v)) return v.trim();
  }
  for (const key of idKeys) {
    const id = details[key]?.trim();
    if (!id) continue;
    const resolved = (memberNames?.[id] ?? "").trim();
    if (isDisplayableName(resolved)) return resolved;
  }
  return null;
}

export interface EventParticipants {
  actor: string | null;
  from: string | null;
  to: string | null;
}

export function resolveEventParticipants(
  event: ConversationEvent,
  details: Record<string, string>,
  memberNames?: Record<string, string>,
): EventParticipants {
  const kind = normalizeActorKind(event.actor_kind, event.actor_id);

  let actor: string | null = null;
  if (kind !== "system") {
    const candidate =
      event.actor_name?.trim() ||
      memberNames?.[event.actor_id]?.trim() ||
      details.actor_username?.trim() ||
      "";
    if (isDisplayableName(candidate)) actor = candidate;
  }

  const fromName = (event.from_name ?? "").trim();
  const from = isDisplayableName(fromName)
    ? fromName
    : firstName(details, FROM_NAME_KEYS, FROM_ID_KEYS, memberNames);

  const toName = (event.to_name ?? "").trim();
  const to = isDisplayableName(toName)
    ? toName
    : firstName(details, TO_NAME_KEYS, TO_ID_KEYS, memberNames);

  return { actor, from, to };
}
