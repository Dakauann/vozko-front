/**
 * Derive a compact "attendance of this conversation" summary from
 * conversation_events + current entry fields (events-only v1, no extra APIs).
 */

import {
  normalizeActorKind,
  parseEventDetails,
  type ConversationEvent,
} from "@/lib/conversations/events";
import {
  resolveCloseProvenance,
  type CloseProvenance,
} from "@/lib/conversations/close-provenance";

export type AttendanceOwnerKind = "human" | "ai" | "system" | "unassigned";

/**
 * Whether the entry's AI auto-reply toggle is on.
 * Matches backend IsAutomationEnabled: nil/undefined defaults to true.
 * Prefer {@link isAiCurrentlyAttending} for inbox badges (who is handling).
 */
export function isAiAutoReplyEnabled(
  automationEnabled?: boolean | null,
): boolean {
  return automationEnabled !== false;
}

/**
 * Whether the conversation should show an "AI attending" chip.
 * Human assignee wins; finished chats hide the chip; AI only when
 * auto-reply is on and no human is owning the thread (or assignee is ai:…).
 */
export function isAiCurrentlyAttending(input: {
  automationEnabled?: boolean | null;
  conversationStatus?: string | null;
  assignedUserId?: string | null;
}): boolean {
  if (input.conversationStatus === "finished") return false;
  if (!isAiAutoReplyEnabled(input.automationEnabled)) return false;
  const assignee = String(input.assignedUserId ?? "").trim();
  if (assignee.startsWith("ai:")) return true;
  if (assignee) return false; // human owns the conversation
  return true; // unassigned + auto-reply on → AI path
}

export interface ConversationAttendanceSummary {
  ownerKind: AttendanceOwnerKind;
  /** Display name for current owner when known (human username). */
  ownerLabel: string | null;
  aiEnabled: boolean;
  assignmentEventCount: number;
  aiSessionStarted: number;
  aiSessionEnded: number;
  openAiSessions: number;
  lastAiOutcome: string | null;
  lastAiEndReason: string | null;
  humanReplyCount: number;
  aiReplyCount: number;
  transferEventCount: number;
  closeProvenance: CloseProvenance | null;
  /** Most recent non-system agent-side actor kind (human | ai). */
  lastAgentKind: "human" | "ai" | null;
}

const ASSIGN_TYPES = new Set([
  "assigned",
  "auto_assigned",
  "unassigned",
]);

const AI_SESSION_START = "ai_session_started";
const AI_SESSION_END = "ai_session_ended";

export function buildConversationAttendanceSummary(input: {
  events: ConversationEvent[];
  assignedUsername?: string | null;
  assignedUserId?: string | null;
  automationEnabled?: boolean | null;
  conversationStatus?: string | null;
  closeSource?: string | null;
  closeReason?: string | null;
}): ConversationAttendanceSummary {
  const {
    events,
    assignedUsername,
    assignedUserId,
    automationEnabled,
    conversationStatus,
    closeSource,
    closeReason,
  } = input;

  let assignmentEventCount = 0;
  let aiSessionStarted = 0;
  let aiSessionEnded = 0;
  let humanReplyCount = 0;
  let aiReplyCount = 0;
  let transferEventCount = 0;
  let lastAiOutcome: string | null = null;
  let lastAiEndReason: string | null = null;
  let lastAgentKind: "human" | "ai" | null = null;

  // Events from API are typically newest-first; walk oldest→newest for "last".
  const chronological = [...events].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (const ev of chronological) {
    const type = ev.event_type;
    if (ASSIGN_TYPES.has(type)) assignmentEventCount += 1;
    if (type === AI_SESSION_START) aiSessionStarted += 1;
    if (type === AI_SESSION_END) {
      aiSessionEnded += 1;
      const d = parseEventDetails(ev.details);
      if (d.outcome) lastAiOutcome = d.outcome;
      if (d.end_reason || d.endReason || d.reason) {
        lastAiEndReason = d.end_reason || d.endReason || d.reason || null;
      }
    }
    if (type === "replied") {
      humanReplyCount += 1;
      lastAgentKind = "human";
    }
    if (type === "ai_replied") {
      aiReplyCount += 1;
      lastAgentKind = "ai";
    }
    if (
      type.startsWith("transfer_") ||
      type.startsWith("queue_") ||
      type === "call_linked"
    ) {
      transferEventCount += 1;
    }
  }

  const openAiSessions = Math.max(0, aiSessionStarted - aiSessionEnded);

  const assignedId = (assignedUserId ?? "").trim();
  const assignedName = (assignedUsername ?? "").trim();
  let ownerKind: AttendanceOwnerKind = "unassigned";
  let ownerLabel: string | null = null;

  // Owner = who is currently responsible, not merely whether the AI toggle is on.
  // Human assignment always wins over the AI auto-reply flag.
  if (assignedId.startsWith("ai:") || normalizeActorKind(undefined, assignedId) === "ai") {
    ownerKind = "ai";
    ownerLabel = assignedName || null;
  } else if (assignedId || assignedName) {
    ownerKind = "human";
    ownerLabel = assignedName || null;
  } else if (isAiAutoReplyEnabled(automationEnabled) && openAiSessions > 0) {
    ownerKind = "ai";
  } else if (isAiAutoReplyEnabled(automationEnabled) && lastAgentKind === "ai") {
    ownerKind = "ai";
  }

  const closeProvenance =
    conversationStatus === "finished"
      ? resolveCloseProvenance(closeSource, closeReason)
      : null;

  return {
    ownerKind,
    ownerLabel,
    // Toggle state (backend defaults null → true via IsAutomationEnabled).
    aiEnabled: isAiAutoReplyEnabled(automationEnabled),
    assignmentEventCount,
    aiSessionStarted,
    aiSessionEnded,
    openAiSessions,
    lastAiOutcome,
    lastAiEndReason,
    humanReplyCount,
    aiReplyCount,
    transferEventCount,
    closeProvenance,
    lastAgentKind,
  };
}

/** Campaign metrics deep-link path (locale-agnostic path segment). */
export function attendanceMetricsHref(params: {
  campaignId?: string | null;
  campaignType?: string | null;
  localePrefix?: string;
}): string {
  const base = `${params.localePrefix ?? ""}/dashboard/attendance`;
  const qs = new URLSearchParams();
  if (params.campaignId) qs.set("campaignId", params.campaignId);
  if (
    params.campaignType === "whatsapp" ||
    params.campaignType === "voice"
  ) {
    qs.set("campaignType", params.campaignType);
  }
  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}
