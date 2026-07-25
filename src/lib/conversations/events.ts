/**
 * Conversation activity timeline (CRM telemetry).
 * Backend: GET /conversations/{entryType}/{entryId}/events
 */

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

export type ConversationActorKind = "human" | "ai" | "system" | string;

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
  /** JSON string map of extra fields from the backend */
  details?: string;
  created_at: string;
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
  if (k === "human" || k === "ai" || k === "system") return k;
  if (actorId.startsWith("ai:")) return "ai";
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
