import { isActionError, settleResult, type ActionResult } from "@/app/actions/action-result";
import { getChecked, sendChecked } from "@/app/actions/checked-request";
import { apiClient } from "@/lib/api/browser-client";
import {
  isMessageEnvelope,
  isReadAnswer,
  isScheduledEnvelope,
  isScheduledList,
  isTeamChatMessagePage,
  isTeamChatPeople,
  isTeamChatSummary,
  isTeamChatThreadPage,
  isThreadEnvelope,
  type TeamChatMessage,
  type TeamChatMessagePage,
  type TeamChatPerson,
  type TeamChatScheduled,
  type TeamChatSummary,
  type TeamChatThread,
  type TeamChatThreadPage,
} from "@/lib/team-chat/types";

export interface TeamChatDraft {
  body: string;
  mentions: string[];
  reply_to_id?: string;
  client_id: string;
}

export interface MessageWindow {
  beforeSeq?: number;
  afterSeq?: number;
  limit?: number;
}

function unwrap<T, K extends string>(result: ActionResult<Record<K, T>>, key: K): ActionResult<T> {
  return isActionError(result) ? result : { data: result.data[key] };
}

async function sendEmpty(path: string, method: "POST" | "PUT" | "DELETE", body?: unknown): Promise<ActionResult<true>> {
  const result = await apiClient<true>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return settleResult(result, true);
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== 0) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const thread = (id: string) => `/team-chat/threads/${encodeURIComponent(id)}`;

export async function getTeamChatSummaryAction(signal?: AbortSignal): Promise<ActionResult<TeamChatSummary>> {
  return getChecked("/team-chat/summary", isTeamChatSummary, "team chat summary", signal);
}

export async function listTeamChatPeopleAction(signal?: AbortSignal): Promise<ActionResult<TeamChatPerson[]>> {
  return unwrap(await getChecked("/team-chat/people", isTeamChatPeople, "team chat people", signal), "people");
}

export async function listTeamChatThreadsAction(cursor: string, limit: number, signal?: AbortSignal): Promise<ActionResult<TeamChatThreadPage>> {
  const result = await getChecked(`/team-chat/threads${query({ cursor, limit })}`, isTeamChatThreadPage, "team chat threads", signal);
  return isActionError(result) ? result : { data: { threads: result.data.threads, next: result.data.next ?? "" } };
}

export async function getTeamChatThreadAction(id: string, signal?: AbortSignal): Promise<ActionResult<TeamChatThread>> {
  return unwrap(await getChecked(thread(id), isThreadEnvelope, "team chat thread", signal), "thread");
}

export async function openDirectAction(userId: string): Promise<ActionResult<TeamChatThread>> {
  return unwrap(await sendChecked("/team-chat/direct", "POST", { user_id: userId }, isThreadEnvelope, "team chat thread"), "thread");
}

export async function createGroupAction(title: string, memberIds: string[]): Promise<ActionResult<TeamChatThread>> {
  return unwrap(await sendChecked("/team-chat/groups", "POST", { title, member_ids: memberIds }, isThreadEnvelope, "team chat thread"), "thread");
}

export async function renameGroupAction(id: string, title: string): Promise<ActionResult<TeamChatThread>> {
  return unwrap(await sendChecked(thread(id), "PATCH", { title }, isThreadEnvelope, "team chat thread"), "thread");
}

export async function addGroupMembersAction(id: string, userIds: string[]): Promise<ActionResult<TeamChatThread>> {
  return unwrap(await sendChecked(`${thread(id)}/members`, "POST", { user_ids: userIds }, isThreadEnvelope, "team chat thread"), "thread");
}

export async function removeGroupMemberAction(id: string, userId: string): Promise<ActionResult<true>> {
  return sendEmpty(`${thread(id)}/members/${encodeURIComponent(userId)}`, "DELETE");
}

export async function leaveGroupAction(id: string): Promise<ActionResult<true>> {
  return sendEmpty(`${thread(id)}/leave`, "POST");
}

export async function muteThreadAction(id: string, muted: boolean): Promise<ActionResult<true>> {
  return sendEmpty(`${thread(id)}/mute`, "PUT", { muted });
}

export async function listTeamChatMessagesAction(id: string, window: MessageWindow, signal?: AbortSignal): Promise<ActionResult<TeamChatMessagePage>> {
  const path = `${thread(id)}/messages${query({ before_seq: window.beforeSeq, after_seq: window.afterSeq, limit: window.limit })}`;
  return getChecked(path, isTeamChatMessagePage, "team chat messages", signal);
}

export async function sendTeamChatMessageAction(id: string, draft: TeamChatDraft): Promise<ActionResult<TeamChatMessage>> {
  return unwrap(await sendChecked(`${thread(id)}/messages`, "POST", draft, isMessageEnvelope, "team chat message"), "message");
}

export async function editTeamChatMessageAction(messageId: string, body: string): Promise<ActionResult<TeamChatMessage>> {
  return unwrap(
    await sendChecked(`/team-chat/messages/${encodeURIComponent(messageId)}`, "PATCH", { body }, isMessageEnvelope, "team chat message"),
    "message",
  );
}

export async function deleteTeamChatMessageAction(messageId: string): Promise<ActionResult<TeamChatMessage>> {
  return unwrap(
    await sendChecked(`/team-chat/messages/${encodeURIComponent(messageId)}`, "DELETE", undefined, isMessageEnvelope, "team chat message"),
    "message",
  );
}

export async function markTeamChatReadAction(id: string, seq: number): Promise<ActionResult<number>> {
  return unwrap(await sendChecked(`${thread(id)}/read`, "POST", { seq }, isReadAnswer, "team chat read"), "last_read_seq");
}

export async function listScheduledTeamMessagesAction(id: string, signal?: AbortSignal): Promise<ActionResult<TeamChatScheduled[]>> {
  return unwrap(await getChecked(`${thread(id)}/scheduled`, isScheduledList, "team chat scheduled", signal), "scheduled");
}

export async function scheduleTeamMessageAction(
  id: string,
  draft: { body: string; mentions: string[]; reply_to_id?: string; send_at: string },
): Promise<ActionResult<TeamChatScheduled>> {
  return unwrap(await sendChecked(`${thread(id)}/scheduled`, "POST", draft, isScheduledEnvelope, "team chat scheduled"), "scheduled");
}

export async function rescheduleTeamMessageAction(
  scheduledId: string,
  change: { body?: string; send_at?: string },
): Promise<ActionResult<TeamChatScheduled>> {
  return unwrap(
    await sendChecked(`/team-chat/scheduled/${encodeURIComponent(scheduledId)}`, "PATCH", change, isScheduledEnvelope, "team chat scheduled"),
    "scheduled",
  );
}

export async function cancelScheduledTeamMessageAction(scheduledId: string): Promise<ActionResult<true>> {
  return sendEmpty(`/team-chat/scheduled/${encodeURIComponent(scheduledId)}`, "DELETE");
}
