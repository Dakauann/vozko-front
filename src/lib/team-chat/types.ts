export type TeamChatKind = "direct" | "group";

export type TeamChatRole = "admin" | "member";

export type TeamChatSystemEvent = "created" | "renamed" | "members_added" | "member_removed" | "member_left";

export type TeamChatScheduledStatus = "pending" | "sent" | "canceled" | "failed";

export interface TeamChatPerson {
  user_id: string;
  name: string;
  picture: string;
}

export interface TeamChatParticipant extends TeamChatPerson {
  role: TeamChatRole;
  last_read_seq: number;
}

export interface TeamChatMessage {
  id: string;
  thread_id: string;
  seq: number;
  author_id: string;
  author_name: string;
  kind: "text" | "system";
  body: string;
  event?: TeamChatSystemEvent;
  subject_ids: string[];
  reply_to_id?: string;
  mentions: string[];
  client_id?: string;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
}

export interface TeamChatThread {
  id: string;
  kind: TeamChatKind;
  title: string;
  created_by: string;
  last_seq: number;
  last_message_at: string;
  created_at: string;
  me: { role: TeamChatRole; last_read_seq: number; muted: boolean };
  members: TeamChatParticipant[];
  last_message?: TeamChatMessage;
  unread: number;
  unread_mentions: number;
}

export interface TeamChatScheduled {
  id: string;
  thread_id: string;
  body: string;
  mentions: string[];
  reply_to_id?: string;
  send_at: string;
  status: TeamChatScheduledStatus;
  failure_reason?: string;
  sent_message_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TeamChatSummary {
  unread_threads: number;
  unread_messages: number;
}

export interface TeamChatThreadPage {
  threads: TeamChatThread[];
  next: string;
}

export interface TeamChatMessagePage {
  messages: TeamChatMessage[];
  has_more: boolean;
}

export interface TeamChatReadMark {
  thread_id: string;
  user_id: string;
  seq: number;
}

export type TeamChatSocketEvent =
  | { type: "team_chat:message"; payload: { thread_id: string; message: TeamChatMessage } }
  | { type: "team_chat:message_updated"; payload: { thread_id: string; message: TeamChatMessage } }
  | { type: "team_chat:read"; payload: TeamChatReadMark }
  | { type: "team_chat:thread"; payload: { thread_id: string } }
  | { type: "team_chat:thread_removed"; payload: { thread_id: string } }
  | { type: "team_chat:typing"; payload: { thread_id: string; user_id: string } }
  | { type: "team_chat:scheduled"; payload: { thread_id: string; scheduled: TeamChatScheduled } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

export function isTeamChatPerson(value: unknown): value is TeamChatPerson {
  return isRecord(value) && isString(value.user_id) && isString(value.name) && isString(value.picture);
}

function isParticipant(value: unknown): value is TeamChatParticipant {
  return isTeamChatPerson(value) && (value as TeamChatParticipant).role !== undefined && isNumber((value as TeamChatParticipant).last_read_seq);
}

export function isTeamChatMessage(value: unknown): value is TeamChatMessage {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.thread_id) &&
    isNumber(value.seq) &&
    isString(value.author_id) &&
    isString(value.author_name) &&
    (value.kind === "text" || value.kind === "system") &&
    isString(value.body) &&
    isStringList(value.subject_ids) &&
    isStringList(value.mentions) &&
    isString(value.created_at) &&
    isOptionalString(value.edited_at) &&
    isOptionalString(value.deleted_at)
  );
}

export function isTeamChatThread(value: unknown): value is TeamChatThread {
  if (!isRecord(value) || !isRecord(value.me) || !Array.isArray(value.members)) return false;
  return (
    isString(value.id) &&
    (value.kind === "direct" || value.kind === "group") &&
    isString(value.title) &&
    isNumber(value.last_seq) &&
    isString(value.last_message_at) &&
    isNumber(value.unread) &&
    isNumber(value.unread_mentions) &&
    isNumber(value.me.last_read_seq) &&
    typeof value.me.muted === "boolean" &&
    value.members.every(isParticipant) &&
    (value.last_message === undefined || value.last_message === null || isTeamChatMessage(value.last_message))
  );
}

export function isTeamChatScheduled(value: unknown): value is TeamChatScheduled {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.thread_id) &&
    isString(value.body) &&
    isStringList(value.mentions) &&
    isString(value.send_at) &&
    (value.status === "pending" || value.status === "sent" || value.status === "canceled" || value.status === "failed")
  );
}

export function isTeamChatSummary(value: unknown): value is TeamChatSummary {
  return isRecord(value) && isNumber(value.unread_threads) && isNumber(value.unread_messages);
}

export function isTeamChatThreadPage(value: unknown): value is TeamChatThreadPage {
  return isRecord(value) && Array.isArray(value.threads) && value.threads.every(isTeamChatThread) && isOptionalString(value.next);
}

export function isTeamChatMessagePage(value: unknown): value is TeamChatMessagePage {
  return isRecord(value) && Array.isArray(value.messages) && value.messages.every(isTeamChatMessage) && typeof value.has_more === "boolean";
}

export function isTeamChatPeople(value: unknown): value is { people: TeamChatPerson[] } {
  return isRecord(value) && Array.isArray(value.people) && value.people.every(isTeamChatPerson);
}

export function isThreadEnvelope(value: unknown): value is { thread: TeamChatThread } {
  return isRecord(value) && isTeamChatThread(value.thread);
}

export function isMessageEnvelope(value: unknown): value is { message: TeamChatMessage } {
  return isRecord(value) && isTeamChatMessage(value.message);
}

export function isScheduledEnvelope(value: unknown): value is { scheduled: TeamChatScheduled } {
  return isRecord(value) && isTeamChatScheduled(value.scheduled);
}

export function isScheduledList(value: unknown): value is { scheduled: TeamChatScheduled[] } {
  return isRecord(value) && Array.isArray(value.scheduled) && value.scheduled.every(isTeamChatScheduled);
}

export function isReadAnswer(value: unknown): value is { last_read_seq: number } {
  return isRecord(value) && isNumber(value.last_read_seq);
}

function isThreadRef(value: unknown): value is { thread_id: string } {
  return isRecord(value) && isString(value.thread_id);
}

export function readTeamChatEvent(type: string, payload: unknown): TeamChatSocketEvent | null {
  if (!isThreadRef(payload)) return null;
  const body = payload as Record<string, unknown>;
  switch (type) {
    case "team_chat:message":
    case "team_chat:message_updated":
      return isTeamChatMessage(body.message) ? { type, payload: { thread_id: payload.thread_id, message: body.message } } : null;
    case "team_chat:read":
      return isString(body.user_id) && isNumber(body.seq) ? { type, payload: { thread_id: payload.thread_id, user_id: body.user_id, seq: body.seq } } : null;
    case "team_chat:thread":
    case "team_chat:thread_removed":
      return { type, payload: { thread_id: payload.thread_id } };
    case "team_chat:typing":
      return isString(body.user_id) ? { type, payload: { thread_id: payload.thread_id, user_id: body.user_id } } : null;
    case "team_chat:scheduled":
      return isTeamChatScheduled(body.scheduled) ? { type, payload: { thread_id: payload.thread_id, scheduled: body.scheduled } } : null;
    default:
      return null;
  }
}
