import { dayKeyReader, GROUP_GAP_MS, type GroupPosition } from "@/lib/conversations/thread-rows";

import type { TeamChatMessage, TeamChatThread } from "./types";

export interface PendingMessage {
  client_id: string;
  body: string;
  mentions: string[];
  reply_to_id?: string;
  created_at: string;
  failed: boolean;
}

export type TeamChatRow =
  | { kind: "day"; key: string; iso: string }
  | { kind: "message"; key: string; message: TeamChatMessage; position: GroupPosition }
  | { kind: "system"; key: string; message: TeamChatMessage };

export function mergeMessages(current: TeamChatMessage[], incoming: TeamChatMessage[]): TeamChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

export function lastSeq(messages: TeamChatMessage[]): number {
  return messages.reduce((highest, m) => Math.max(highest, m.seq), 0);
}

export function missedAfter(messages: TeamChatMessage[], arrival: TeamChatMessage): number | null {
  if (messages.length === 0) return null;
  const highest = lastSeq(messages);
  return arrival.seq > highest + 1 ? highest : null;
}

export function pendingAfterDelivery(pending: PendingMessage[], delivered: TeamChatMessage[]): PendingMessage[] {
  const arrived = new Set(delivered.map((m) => m.client_id).filter(Boolean));
  const left = pending.filter((p) => !arrived.has(p.client_id));
  return left.length === pending.length ? pending : left;
}

function timeOf(message: TeamChatMessage): number {
  return new Date(message.created_at).getTime();
}

function joins(previous: TeamChatMessage | null, current: TeamChatMessage): boolean {
  return previous !== null && previous.author_id === current.author_id && timeOf(current) - timeOf(previous) <= GROUP_GAP_MS;
}

function positionOf(joinsPrevious: boolean, joinsNext: boolean): GroupPosition {
  if (joinsPrevious && joinsNext) return "middle";
  if (joinsPrevious) return "last";
  if (joinsNext) return "first";
  return "single";
}

export function threadRows(messages: TeamChatMessage[], timeZone?: string): TeamChatRow[] {
  const dayOf = dayKeyReader(timeZone);
  const rows: TeamChatRow[] = [];
  let previousDay = "";
  let run: TeamChatMessage[] = [];
  const closeRun = () => {
    run.forEach((message, index) => {
      rows.push({ kind: "message", key: message.id, message, position: positionOf(index > 0, index < run.length - 1) });
    });
    run = [];
  };
  for (const message of messages) {
    const day = dayOf(message.created_at);
    if (day !== previousDay) {
      closeRun();
      rows.push({ kind: "day", key: `day:${day}`, iso: message.created_at });
      previousDay = day;
    }
    if (message.kind === "system") {
      closeRun();
      rows.push({ kind: "system", key: message.id, message });
      continue;
    }
    if (!joins(run[run.length - 1] ?? null, message)) closeRun();
    run.push(message);
  }
  closeRun();
  return rows;
}

export function readByOthers(thread: TeamChatThread, message: TeamChatMessage, me: string): boolean {
  return thread.members.some((m) => m.user_id !== me && m.last_read_seq >= message.seq);
}

export function threadTitle(thread: TeamChatThread, me: string): string {
  if (thread.kind === "group") return thread.title;
  return thread.members.find((m) => m.user_id !== me)?.name ?? thread.title;
}

export function otherMember(thread: TeamChatThread, me: string) {
  return thread.kind === "direct" ? thread.members.find((m) => m.user_id !== me) ?? null : null;
}
