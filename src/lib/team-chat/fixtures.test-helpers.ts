import type { TeamChatMessage, TeamChatThread } from "./types";

export const ME = "u-me";

export function message(seq: number, overrides: Partial<TeamChatMessage> = {}): TeamChatMessage {
  return {
    id: `m-${seq}`,
    thread_id: "t-1",
    seq,
    author_id: "u-bia",
    author_name: "Bia",
    kind: "text",
    body: `mensagem ${seq}`,
    subject_ids: [],
    mentions: [],
    created_at: `2026-10-19T12:${String(seq).padStart(2, "0")}:00Z`,
    ...overrides,
  };
}

export function thread(id: string, overrides: Partial<TeamChatThread> = {}): TeamChatThread {
  return {
    id,
    kind: "direct",
    title: "",
    created_by: ME,
    last_seq: 0,
    last_message_at: "2026-10-19T10:00:00Z",
    created_at: "2026-10-19T09:00:00Z",
    me: { role: "member", last_read_seq: 0, muted: false },
    members: [
      { user_id: ME, name: "Eu", picture: "", role: "member", last_read_seq: 0 },
      { user_id: "u-bia", name: "Bia", picture: "", role: "member", last_read_seq: 0 },
    ],
    unread: 0,
    unread_mentions: 0,
    ...overrides,
  };
}
