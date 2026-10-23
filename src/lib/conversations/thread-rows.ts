import { isOutgoingMessage, messageTypeOf, senderBadge } from "./direction";
import { isLikeSticker, metaPrefix, readStickerId } from "./meta-metadata";
import { senderOf } from "./sender";
import type { AgentToolCall } from "./agent-tool-calls";
import type { ConversationNote } from "./notes";
import { isToolMessage, toolCallIdOf, toolCallNameOf } from "./tool-events";
import type { ConversationMessage } from "./types";
import { groupPosition, joinsGroup, type GroupPosition } from "@/lib/chat/message-groups";

export { GROUP_GAP_MS, joinedEdges, opensGroup, type GroupPosition } from "@/lib/chat/message-groups";

const RECORDED_CALL_WINDOW_MS = 2 * 60 * 1000;

type SimpleEventKind = "system" | "call" | "call-permission" | "story" | "unsupported" | "like-sticker";

type SimpleEventRow = {
  [K in SimpleEventKind]: { kind: K; key: string; message: ConversationMessage; runGap: boolean };
}[SimpleEventKind];

export type ThreadRow =
  | { kind: "day"; key: string; dayKey: string; iso: string }
  | { kind: "unread-divider"; key: string }
  | {
      kind: "message";
      key: string;
      message: ConversationMessage;
      outgoing: boolean;
      groupPosition: GroupPosition;
      channelRunStart: boolean;
      runGap: boolean;
    }
  | {
      kind: "tool";
      key: string;
      message: ConversationMessage;
      previous: ConversationMessage | null;
      next: ConversationMessage | null;
      runGap: boolean;
    }
  | { kind: "note"; key: string; note: ConversationNote }
  | { kind: "agent-tool-call"; key: string; call: AgentToolCall }
  | SimpleEventRow;

export type ThreadRowKind = ThreadRow["kind"];

export interface ThreadRowOptions {
  unreadFrom: string | null;
  leadNumber?: string | null;
  timeZone?: string;
  notes?: readonly ConversationNote[];
  toolCalls?: readonly AgentToolCall[];
}

const CALL_TYPES = new Set(["call_received", "call_answered", "call_missed", "call_ended"]);
const CALL_PERMISSION_TYPES = new Set(["call_permission_request", "call_permission_granted", "call_permission_rejected"]);
const STORY_TYPES = new Set(["story_reply", "story_mention"]);
const SYSTEM_RUN = "__system__";
const ASIDE_RUN = "__aside__";

type AsideItem = { kind: "note"; note: ConversationNote } | { kind: "agent-tool-call"; call: AgentToolCall };

type TimelineItem = { kind: "message"; message: ConversationMessage } | AsideItem;

interface Run {
  channel: string;
  items: TimelineItem[];
}

interface DraftMessage {
  row: Extract<ThreadRow, { kind: "message" }>;
  joinsPrevious: boolean;
}

type Draft = ThreadRow | DraftMessage;

export function dayKeyReader(timeZone: string | undefined): (iso: string) => string {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso || "unknown" : format.format(date);
  };
}

function timeOf(message: ConversationMessage): number {
  const time = new Date(message.created_at).getTime();
  return Number.isNaN(time) ? Number.NaN : time;
}

function itemIso(item: TimelineItem): string {
  if (item.kind === "note") return item.note.created_at;
  if (item.kind === "agent-tool-call") return item.call.createdAt;
  return item.message.created_at;
}

function itemTime(item: TimelineItem): number {
  return new Date(itemIso(item)).getTime();
}

function timeline(messages: ConversationMessage[], notes: readonly ConversationNote[], toolCalls: readonly AgentToolCall[]): TimelineItem[] {
  const pending: AsideItem[] = [
    ...notes.map((note): AsideItem => ({ kind: "note", note })),
    ...toolCalls.map((call): AsideItem => ({ kind: "agent-tool-call", call })),
  ].sort((a, b) => itemTime(a) - itemTime(b));
  const items: TimelineItem[] = [];
  for (const message of messages) {
    const item: TimelineItem = { kind: "message", message };
    while (pending.length > 0 && itemTime(pending[0]) < itemTime(item)) {
      items.push(pending.shift() as AsideItem);
    }
    items.push(item);
  }
  items.push(...pending);
  return items;
}

function recordedToolMessages(messages: readonly ConversationMessage[], toolCalls: readonly AgentToolCall[]): Set<string> {
  const recorded = new Set<string>();
  if (toolCalls.length === 0) return recorded;
  const candidates = messages.flatMap((message) => {
    const toolName = toolCallNameOf(message);
    return toolName ? [{ id: message.id, toolName, at: timeOf(message), toolCallId: toolCallIdOf(message) }] : [];
  });
  const byToolCallId = new Map(candidates.flatMap((candidate) => (candidate.toolCallId ? [[candidate.toolCallId, candidate.id] as const] : [])));
  const unpaired: AgentToolCall[] = [];
  for (const call of toolCalls) {
    const paired = call.toolCallId ? byToolCallId.get(call.toolCallId) : undefined;
    if (paired && !recorded.has(paired)) recorded.add(paired);
    else unpaired.push(call);
  }
  for (const call of unpaired) {
    const at = new Date(call.createdAt).getTime();
    let best: { id: string; gap: number } | null = null;
    for (const candidate of candidates) {
      if (recorded.has(candidate.id) || candidate.toolName !== call.toolName) continue;
      if (call.toolCallId && candidate.toolCallId) continue;
      const gap = Math.abs(candidate.at - at);
      if (gap <= RECORDED_CALL_WINDOW_MS && (best === null || gap < best.gap)) best = { id: candidate.id, gap };
    }
    if (best) recorded.add(best.id);
  }
  return recorded;
}

function standaloneRun(item: TimelineItem): string | null {
  if (item.kind !== "message") return ASIDE_RUN;
  return messageTypeOf(item.message) === "system" ? SYSTEM_RUN : null;
}

function channelRuns(items: TimelineItem[]): Run[] {
  const runs: Run[] = [];
  for (const item of items) {
    const standalone = standaloneRun(item);
    if (standalone) {
      runs.push({ channel: standalone, items: [item] });
      continue;
    }
    const channel: string = item.kind === "message" ? (item.message.channel ?? "") : "";
    const last = runs[runs.length - 1];
    if (!last || last.channel !== channel || last.channel === SYSTEM_RUN || last.channel === ASIDE_RUN) {
      runs.push({ channel, items: [item] });
    } else {
      last.items.push(item);
    }
  }
  return runs;
}

function messagesOf(run: Run): ConversationMessage[] {
  return run.items.flatMap((item) => (item.kind === "message" ? [item.message] : []));
}

function eventKindOf(message: ConversationMessage): SimpleEventKind | "tool" | null {
  const messageType = messageTypeOf(message) ?? "";
  if (messageType === "system") return "system";
  if (CALL_TYPES.has(messageType)) return "call";
  if (STORY_TYPES.has(messageType)) return "story";
  if (messageType === "unsupported") return "unsupported";
  const prefix = metaPrefix(message.channel ?? message.entry_type);
  const metadata = (message.metadata ?? null) as Record<string, unknown> | null;
  if (messageType === "sticker" && prefix && isLikeSticker(readStickerId(metadata, prefix))) return "like-sticker";
  if (CALL_PERMISSION_TYPES.has(messageType)) return "call-permission";
  if (isToolMessage(message)) return "tool";
  return null;
}

function senderKey(message: ConversationMessage, outgoing: boolean, leadNumber: string | null | undefined): string {
  const sender = senderOf(message);
  if (sender) return `${sender.kind}:${sender.id}`;
  if (!outgoing) return `in:${message.from}`;
  return `out:${senderBadge(message, leadNumber) ?? ""}:${message.sender_name ?? ""}`;
}

function isDraftMessage(draft: Draft): draft is DraftMessage {
  return "joinsPrevious" in draft;
}

function settlePositions(drafts: Draft[]): ThreadRow[] {
  return drafts.map((draft, index) => {
    if (!isDraftMessage(draft)) return draft;
    const following = drafts[index + 1];
    const joinsNext = following !== undefined && isDraftMessage(following) && following.joinsPrevious;
    return { ...draft.row, groupPosition: groupPosition(draft.joinsPrevious, joinsNext) };
  });
}

function rowIdentity(message: ConversationMessage): string {
  return message.client_request_id ? `send:${message.client_request_id}` : message.id;
}

function uniqueKey(seen: Set<string>, base: string): string {
  let key = base;
  let suffix = 1;
  while (seen.has(key)) key = `${base}:${suffix++}`;
  seen.add(key);
  return key;
}

export function buildThreadRows(messages: ConversationMessage[], options: ThreadRowOptions): ThreadRow[] {
  const dayKeyOf = dayKeyReader(options.timeZone);
  const drafts: Draft[] = [];
  const keys = new Set<string>();
  const recorded = recordedToolMessages(messages, options.toolCalls ?? []);
  let previousSender: { key: string; message: ConversationMessage } | null = null;

  const days: { dayKey: string; items: TimelineItem[] }[] = [];
  for (const item of timeline(messages, options.notes ?? [], options.toolCalls ?? [])) {
    const dayKey = dayKeyOf(itemIso(item));
    const last = days[days.length - 1];
    if (last && last.dayKey === dayKey) last.items.push(item);
    else days.push({ dayKey, items: [item] });
  }

  for (const day of days) {
    drafts.push({ kind: "day", key: uniqueKey(keys, `day:${day.dayKey}`), dayKey: day.dayKey, iso: itemIso(day.items[0]) });
    previousSender = null;

    channelRuns(day.items).forEach((run, runIndex) => {
      previousSender = null;
      if (run.channel === ASIDE_RUN) {
        for (const item of run.items) {
          if (item.kind === "note") drafts.push({ kind: "note", key: uniqueKey(keys, `note:${item.note.id}`), note: item.note });
          if (item.kind === "agent-tool-call") drafts.push({ kind: "agent-tool-call", key: uniqueKey(keys, `tool-call:${item.call.id}`), call: item.call });
        }
        return;
      }
      const runMessages = messagesOf(run);
      runMessages.forEach((message, indexInRun) => {
        const key = uniqueKey(keys, rowIdentity(message) || `message:${drafts.length}`);
        const runGap = runIndex > 0 && indexInRun === 0 && run.channel !== SYSTEM_RUN;

        if (options.unreadFrom && message.id === options.unreadFrom) {
          drafts.push({ kind: "unread-divider", key: uniqueKey(keys, "unread-divider") });
          previousSender = null;
        }

        const eventKind = eventKindOf(message);
        if (eventKind === "tool" && recorded.has(message.id)) {
          previousSender = null;
          return;
        }
        if (eventKind === "tool") {
          drafts.push({
            kind: "tool",
            key,
            message,
            previous: runMessages[indexInRun - 1] ?? null,
            next: runMessages[indexInRun + 1] ?? null,
            runGap,
          });
          previousSender = null;
          return;
        }
        if (eventKind) {
          drafts.push({ kind: eventKind, key, message, runGap });
          previousSender = null;
          return;
        }

        const outgoing = isOutgoingMessage(message, options.leadNumber);
        const sender = senderKey(message, outgoing, options.leadNumber);
        const joinsPrevious = joinsGroup(previousSender && { author: previousSender.key, at: previousSender.message.created_at }, { author: sender, at: message.created_at });
        drafts.push({
          row: {
            kind: "message",
            key,
            message,
            outgoing,
            groupPosition: "single",
            channelRunStart: indexInRun === 0,
            runGap,
          },
          joinsPrevious,
        });
        previousSender = { key: sender, message };
      });
    });
  }

  return settlePositions(drafts);
}

export type DayRow = Extract<ThreadRow, { kind: "day" }>;

export interface DaySection {
  day: DayRow;
  rows: ThreadRow[];
}

export function daySections(rows: readonly ThreadRow[]): DaySection[] {
  const sections: DaySection[] = [];
  for (const row of rows) {
    if (row.kind === "day") sections.push({ day: row, rows: [] });
    else sections[sections.length - 1]?.rows.push(row);
  }
  return sections;
}
