import type { TeamChatMessage, TeamChatReadMark, TeamChatThread } from "./types";

export function sortThreads(threads: TeamChatThread[]): TeamChatThread[] {
  return [...threads].sort((a, b) => {
    if (a.last_message_at === b.last_message_at) return a.id < b.id ? 1 : -1;
    return a.last_message_at < b.last_message_at ? 1 : -1;
  });
}

export function threadsAfterMessage(threads: TeamChatThread[], message: TeamChatMessage, me: string): TeamChatThread[] | null {
  const current = threads.find((t) => t.id === message.thread_id);
  if (!current) return null;
  if (message.seq <= current.last_seq) return threads;
  const mine = message.author_id === me;
  const lastRead = mine ? message.seq : current.me.last_read_seq;
  const updated: TeamChatThread = {
    ...current,
    last_seq: message.seq,
    last_message_at: message.created_at,
    last_message: message,
    me: { ...current.me, last_read_seq: lastRead },
    unread: Math.max(0, message.seq - lastRead),
    unread_mentions: mine ? 0 : current.unread_mentions + (message.mentions.includes(me) ? 1 : 0),
  };
  return sortThreads(threads.map((t) => (t.id === updated.id ? updated : t)));
}

export function threadsAfterRead(threads: TeamChatThread[], mark: TeamChatReadMark, me: string): TeamChatThread[] {
  return threads.map((t) => {
    if (t.id !== mark.thread_id) return t;
    const members = t.members.map((m) => (m.user_id === mark.user_id ? { ...m, last_read_seq: Math.max(m.last_read_seq, mark.seq) } : m));
    if (mark.user_id !== me) return { ...t, members };
    const lastRead = Math.max(t.me.last_read_seq, mark.seq);
    const unread = Math.max(0, t.last_seq - lastRead);
    return { ...t, members, me: { ...t.me, last_read_seq: lastRead }, unread, unread_mentions: unread === 0 ? 0 : t.unread_mentions };
  });
}

export function threadsAfterMessageChange(threads: TeamChatThread[], message: TeamChatMessage): TeamChatThread[] {
  if (!threads.some((t) => t.last_message?.id === message.id)) return threads;
  return threads.map((t) => (t.last_message?.id === message.id ? { ...t, last_message: message } : t));
}

export function upsertThread(threads: TeamChatThread[], thread: TeamChatThread): TeamChatThread[] {
  return sortThreads([...threads.filter((t) => t.id !== thread.id), thread]);
}

export function withoutThread(threads: TeamChatThread[], threadId: string): TeamChatThread[] {
  return threads.filter((t) => t.id !== threadId);
}
