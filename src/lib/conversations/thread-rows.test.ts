import { describe, expect, it } from "vitest";

import { buildThreadRows, daySections, joinedEdges, type ThreadRow } from "./thread-rows";
import type { AgentToolCall } from "./agent-tool-calls";
import type { ConversationNote } from "./notes";
import type { ConversationMessage } from "./types";

const LEAD = "+5511999999999";

function msg(id: string, iso: string, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id,
    entry_id: "e1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "user_message",
    from: LEAD,
    to: "+5511888888888",
    text: id,
    sender_name: "Lead",
    read: true,
    read_at: null,
    read_by: null,
    created_at: iso,
    updated_at: iso,
    ...overrides,
  };
}

const at = (hour: number, minute: number, day = 18) => new Date(Date.UTC(2026, 9, day, hour, minute)).toISOString();

function shape(rows: ThreadRow[]): string[] {
  return rows.map((row) => {
    if (row.kind === "day") return `day:${row.dayKey}`;
    if (row.kind === "unread-divider") return "divider";
    if (row.kind === "message") return `${row.message.id}:${row.groupPosition}`;
    if (row.kind === "note") return `note:${row.note.id}`;
    if (row.kind === "agent-tool-call") return `agent-tool-call:${row.call.id}`;
    return `${row.kind}:${row.message.id}`;
  });
}

function rows(messages: ConversationMessage[], unreadFrom: string | null = null, timeZone = "UTC") {
  return buildThreadRows(messages, { unreadFrom, timeZone, leadNumber: LEAD });
}

describe("thread rows: day boundaries", () => {
  it("splits days where the viewer's clock turns midnight, not where UTC does", () => {
    const messages = [msg("a", at(2, 30)), msg("b", at(4, 0))];
    expect(shape(rows(messages, null, "America/Sao_Paulo"))).toEqual([
      "day:2026-10-17",
      "a:single",
      "day:2026-10-18",
      "b:single",
    ]);
  });

  it("keeps the same two messages under one day for a viewer in UTC", () => {
    const messages = [msg("a", at(2, 30)), msg("b", at(4, 0))];
    expect(shape(rows(messages))).toEqual(["day:2026-10-18", "a:single", "b:single"]);
  });

  it("files a message with an unreadable timestamp under its own day instead of inventing a date", () => {
    expect(shape(rows([msg("a", "garbage")]))).toEqual(["day:garbage", "a:single"]);
  });

  it("never lets a group run across a day boundary", () => {
    const messages = [msg("a", at(23, 58, 17)), msg("b", at(0, 1))];
    expect(shape(rows(messages))).toEqual(["day:2026-10-17", "a:single", "day:2026-10-18", "b:single"]);
  });
});

describe("thread rows: grouping", () => {
  it("groups the same sender within five minutes into first, middle and last", () => {
    const messages = [msg("a", at(10, 0)), msg("b", at(10, 2)), msg("c", at(10, 5))];
    expect(shape(rows(messages)).slice(1)).toEqual(["a:first", "b:middle", "c:last"]);
  });

  it("starts a new group after a gap longer than five minutes", () => {
    const messages = [msg("a", at(10, 0)), msg("b", at(10, 6))];
    expect(shape(rows(messages)).slice(1)).toEqual(["a:single", "b:single"]);
  });

  it("starts a new group when the other side speaks", () => {
    const messages = [
      msg("a", at(10, 0)),
      msg("b", at(10, 1), { message_type: "operator", from: "+5511888888888", to: LEAD }),
      msg("c", at(10, 2)),
    ];
    expect(shape(rows(messages)).slice(1)).toEqual(["a:single", "b:single", "c:single"]);
  });

  it("starts a new group when a different person speaks in a group chat", () => {
    const messages = [msg("a", at(10, 0), { from: "+551101" }), msg("b", at(10, 1), { from: "+551102" })];
    expect(shape(rows(messages)).slice(1)).toEqual(["a:single", "b:single"]);
  });

  it("keeps the AI and a human operator apart even though both are outgoing", () => {
    const messages = [
      msg("a", at(10, 0), { message_type: "ai_response" }),
      msg("b", at(10, 1), { message_type: "operator" }),
    ];
    expect(shape(rows(messages)).slice(1)).toEqual(["a:single", "b:single"]);
  });

  it("breaks a group around an event row", () => {
    const messages = [
      msg("a", at(10, 0)),
      msg("t", at(10, 1), { message_type: "tool_call", text: "[Tool Call] x: map[]" }),
      msg("b", at(10, 2)),
    ];
    expect(shape(rows(messages)).slice(1)).toEqual(["a:single", "tool:t", "b:single"]);
  });

  it("breaks a group where the channel changes and marks the start of the new channel run", () => {
    const messages = [msg("a", at(10, 0)), msg("b", at(10, 1), { channel: "telegram" })];
    const built = rows(messages).filter((row) => row.kind === "message");
    expect(built.map((row) => (row.kind === "message" ? [row.groupPosition, row.channelRunStart] : null))).toEqual([
      ["single", true],
      ["single", true],
    ]);
  });

  it("marks only the first message of a channel run as its start", () => {
    const built = rows([msg("a", at(10, 0)), msg("b", at(10, 1))]).filter((row) => row.kind === "message");
    expect(built.map((row) => row.kind === "message" && row.channelRunStart)).toEqual([true, false]);
  });

  it("tells the bubble which side it sits on", () => {
    const built = rows([msg("a", at(10, 0), { message_type: "operator" })]);
    const message = built.find((row) => row.kind === "message");
    expect(message?.kind === "message" && message.outgoing).toBe(true);
  });

  it("keeps one row key for a send from its pending bubble to the delivered message, so the bubble never remounts", () => {
    const pending = rows([msg("pending:r1", at(10, 0), { message_type: "operator", client_request_id: "r1" })]);
    const delivered = rows([msg("m1", at(10, 0), { message_type: "operator", client_request_id: "r1" })]);
    const keyOf = (built: ThreadRow[]) => built.find((row) => row.kind === "message")?.key;
    expect(keyOf(pending)).toBe(keyOf(delivered));
  });
});

describe("thread rows: unread divider", () => {
  it("sits right before the first unread message", () => {
    const messages = [msg("a", at(10, 0)), msg("b", at(10, 1), { read: false }), msg("c", at(10, 2), { read: false })];
    expect(shape(rows(messages, "b")).slice(1)).toEqual(["a:single", "divider", "b:first", "c:last"]);
  });

  it("sits after the day header when the first unread message opens a day", () => {
    const messages = [msg("a", at(10, 0, 17)), msg("b", at(10, 0))];
    expect(shape(rows(messages, "b"))).toEqual(["day:2026-10-17", "a:single", "day:2026-10-18", "divider", "b:single"]);
  });

  it("is absent when nothing was unread on open", () => {
    expect(shape(rows([msg("a", at(10, 0))], null))).not.toContain("divider");
  });

  it("is absent when the first unread message is not in the loaded page", () => {
    expect(shape(rows([msg("a", at(10, 0))], "gone"))).not.toContain("divider");
  });
});

describe("thread rows: event kinds", () => {
  const cases: { name: string; overrides: Partial<ConversationMessage>; kind: ThreadRow["kind"] }[] = [
    { name: "a system note", overrides: { message_type: "system" }, kind: "system" },
    { name: "a missed call", overrides: { message_type: "call_missed" as ConversationMessage["message_type"] }, kind: "call" },
    { name: "a story reply", overrides: { message_type: "story_reply" as ConversationMessage["message_type"], channel: "instagram" }, kind: "story" },
    { name: "an unsupported message", overrides: { message_type: "unsupported" as ConversationMessage["message_type"] }, kind: "unsupported" },
    {
      name: "a call permission answer",
      overrides: { message_type: "call_permission_granted" as ConversationMessage["message_type"] },
      kind: "call-permission",
    },
    {
      name: "a Messenger like sticker",
      overrides: {
        message_type: "sticker" as ConversationMessage["message_type"],
        channel: "facebook",
        metadata: { facebook_sticker_id: "369239263222822" } as unknown as ConversationMessage["metadata"],
      },
      kind: "like-sticker",
    },
    { name: "a tool result told only by its text prefix", overrides: { text: "[Tool Result] ok" }, kind: "tool" },
    { name: "a plain text message", overrides: {}, kind: "message" },
  ];

  for (const c of cases) {
    it(`renders ${c.name} as a ${c.kind} row`, () => {
      const built = rows([msg("m", at(10, 0), c.overrides)]);
      expect(built[1].kind).toBe(c.kind);
    });
  }

  it("hands a tool row its neighbours in the channel run so a call can find its result", () => {
    const messages = [
      msg("call", at(10, 0), { message_type: "tool_call", text: "[Tool Call] x: map[]" }),
      msg("result", at(10, 0), { message_type: "tool_result", text: "[Tool Result] ok" }),
    ];
    const tools = rows(messages).filter((row) => row.kind === "tool");
    expect(tools.map((row) => (row.kind === "tool" ? [row.previous?.id ?? null, row.next?.id ?? null] : null))).toEqual([
      [null, "result"],
      ["call", null],
    ]);
  });

  it("starts a fresh channel run after a system note", () => {
    const messages = [msg("a", at(10, 0)), msg("s", at(10, 1), { message_type: "system" }), msg("b", at(10, 2))];
    const starts = rows(messages).flatMap((row) => (row.kind === "message" ? [row.channelRunStart] : []));
    expect(starts).toEqual([true, true]);
  });
});

describe("joined edges", () => {
  it("joins only the sides that touch another bubble of the same group", () => {
    expect(joinedEdges("single")).toEqual({ top: false, bottom: false });
    expect(joinedEdges("first")).toEqual({ top: false, bottom: true });
    expect(joinedEdges("middle")).toEqual({ top: true, bottom: true });
    expect(joinedEdges("last")).toEqual({ top: true, bottom: false });
  });
});

describe("day sections", () => {
  it("puts every row under the day it belongs to, so a sticky header only covers its own day", () => {
    const built = rows([msg("a", at(10, 0, 17)), msg("b", at(10, 0)), msg("c", at(10, 1), { read: false })], "c");
    expect(
      daySections(built).map((section) => [section.day.dayKey, section.rows.map((row) => (row.kind === "message" ? row.message.id : row.kind))]),
    ).toEqual([
      ["2026-10-17", ["a"]],
      ["2026-10-18", ["b", "unread-divider", "c"]],
    ]);
  });

  it("has no sections for an empty thread", () => {
    expect(daySections([])).toEqual([]);
  });
});

describe("internal notes in the thread", () => {
  const note = (id: string, created_at: string): ConversationNote => ({
    id,
    entry_id: "e1",
    entry_type: "whatsapp",
    author_id: "u-ana",
    author_name: "Ana",
    body: id,
    mentions: [],
    created_at,
  });

  function withNotes(messages: ConversationMessage[], notes: ConversationNote[], unreadFrom: string | null = null) {
    return buildThreadRows(messages, { unreadFrom, timeZone: "UTC", leadNumber: LEAD, notes });
  }

  it("places each note between the messages around its time, as its own row", () => {
    const built = withNotes([msg("a", at(10, 0)), msg("b", at(10, 4))], [note("n1", at(10, 2))]);
    expect(shape(built)).toEqual(["day:2026-10-18", "a:single", "note:n1", "b:single"]);
  });

  it("breaks a group of bubbles, because a note between them is not part of either", () => {
    const built = withNotes([msg("a", at(10, 0)), msg("b", at(10, 1)), msg("c", at(10, 2))], [note("n1", "2026-10-18T10:01:30.000Z")]);
    expect(shape(built)).toEqual(["day:2026-10-18", "a:first", "b:last", "note:n1", "c:single"]);
  });

  it("puts a note newer than every message at the end, under its own day when the day changed", () => {
    const built = withNotes([msg("a", at(10, 0, 17))], [note("n1", at(9, 0))]);
    expect(shape(built)).toEqual(["day:2026-10-17", "a:single", "day:2026-10-18", "note:n1"]);
  });

  it("keeps the unread divider before the first unread message even with a note right before it", () => {
    const built = withNotes([msg("a", at(10, 0)), msg("b", at(10, 4), { read: false })], [note("n1", at(10, 2))], "b");
    expect(shape(built)).toEqual(["day:2026-10-18", "a:single", "note:n1", "divider", "b:single"]);
  });

  it("shows a conversation that only has notes", () => {
    expect(shape(withNotes([], [note("n1", at(9, 0))]))).toEqual(["day:2026-10-18", "note:n1"]);
  });
});

describe("agent tool calls in the thread", () => {
  const toolCall = (id: string, createdAt: string): AgentToolCall => ({
    id,
    entryId: "e1",
    entryType: "whatsapp",
    agentId: "ag1",
    toolName: "run_workflow_wf1",
    outcome: "ok",
    durationMs: 10,
    createdAt,
  });

  function withCalls(messages: ConversationMessage[], toolCalls: AgentToolCall[], notes: ConversationNote[] = []) {
    return buildThreadRows(messages, { unreadFrom: null, timeZone: "UTC", leadNumber: LEAD, notes, toolCalls });
  }

  it("places each call by time between the messages, as its own line", () => {
    const built = withCalls([msg("a", at(10, 0)), msg("b", at(10, 4))], [toolCall("t1", at(10, 2))]);
    expect(shape(built)).toEqual(["day:2026-10-18", "a:single", "agent-tool-call:t1", "b:single"]);
  });

  it("breaks a group of bubbles like a note does", () => {
    const built = withCalls([msg("a", at(10, 0)), msg("b", at(10, 2))], [toolCall("t1", at(10, 1))]);
    expect(shape(built)).toEqual(["day:2026-10-18", "a:single", "agent-tool-call:t1", "b:single"]);
  });

  it("orders notes and calls between the same messages by their own times", () => {
    const note = { id: "n1", entry_id: "e1", entry_type: "whatsapp", author_id: "u", author_name: "Ana", body: "x", mentions: [], created_at: at(10, 3) };
    const built = withCalls([msg("a", at(10, 0)), msg("b", at(10, 5))], [toolCall("t1", at(10, 4)), toolCall("t0", at(10, 1))], [note]);
    expect(shape(built)).toEqual(["day:2026-10-18", "a:single", "agent-tool-call:t0", "note:n1", "agent-tool-call:t1", "b:single"]);
  });

  it("puts a call newer than every message at the end", () => {
    expect(shape(withCalls([msg("a", at(10, 0))], [toolCall("t1", at(11, 0))]))).toEqual(["day:2026-10-18", "a:single", "agent-tool-call:t1"]);
  });
});

describe("agent tool calls already written to the history", () => {
  const record = (id: string, createdAt: string, toolName = "run_workflow_wf1"): AgentToolCall => ({
    id,
    entryId: "e1",
    entryType: "whatsapp",
    agentId: "ag1",
    toolName,
    outcome: "ok",
    durationMs: 10,
    createdAt,
  });
  const toolMessage = (id: string, iso: string, text: string, type: "tool_call" | "tool_result" = "tool_call") =>
    msg(id, iso, { message_type: type, text, from: "system", to: "system" });

  function rowsOf(messages: ConversationMessage[], toolCalls: AgentToolCall[]) {
    return shape(buildThreadRows(messages, { unreadFrom: null, timeZone: "UTC", leadNumber: LEAD, toolCalls }));
  }

  it("shows the record instead of the history chip of the same call, keeping the result chip", () => {
    const built = rowsOf(
      [
        msg("a", at(10, 0)),
        toolMessage("call", "2026-10-18T10:01:10.000Z", '[Tool Call] run_workflow_wf1: {"cpf":"1"}'),
        toolMessage("result", "2026-10-18T10:01:11.000Z", "[Tool Result] execução iniciada", "tool_result"),
      ],
      [record("t1", "2026-10-18T10:01:05.000Z")],
    );
    expect(built).toEqual(["day:2026-10-18", "a:single", "agent-tool-call:t1", "tool:result"]);
  });

  it("keeps the history chip of another tool or of a call too far apart in time", () => {
    const built = rowsOf(
      [toolMessage("other", at(10, 1), "[Tool Call] http_request: {}"), toolMessage("late", at(10, 30), "[Tool Call] run_workflow_wf1: {}")],
      [record("t1", at(10, 1))],
    );
    expect(built).toEqual(["day:2026-10-18", "tool:other", "agent-tool-call:t1", "tool:late"]);
  });

  const withId = (message: ConversationMessage, toolCallId: string): ConversationMessage => ({
    ...message,
    metadata: { tool_call_id: toolCallId } as unknown as ConversationMessage["metadata"],
  });

  it("pairs a record with the history chip that carries its tool call id, however far apart in time", () => {
    const built = rowsOf(
      [
        withId(toolMessage("near", at(10, 1), "[Tool Call] run_workflow_wf1: {}"), "call_other"),
        withId(toolMessage("far", at(10, 30), "[Tool Call] run_workflow_wf1: {}"), "call_1"),
      ],
      [{ ...record("t1", at(10, 1)), toolCallId: "call_1" }],
    );
    expect(built).toEqual(["day:2026-10-18", "tool:near", "agent-tool-call:t1"]);
  });

  it("never pairs by name and time when both sides carry different ids", () => {
    const built = rowsOf(
      [withId(toolMessage("call", at(10, 1), "[Tool Call] run_workflow_wf1: {}"), "call_other")],
      [{ ...record("t1", at(10, 1)), toolCallId: "call_1" }],
    );
    expect(built).toEqual(["day:2026-10-18", "tool:call", "agent-tool-call:t1"]);
  });

  it("falls back to name and time when the history row has no id", () => {
    const built = rowsOf(
      [toolMessage("call", at(10, 1), "[Tool Call] run_workflow_wf1: {}")],
      [{ ...record("t1", at(10, 1)), toolCallId: "call_1" }],
    );
    expect(built).toEqual(["day:2026-10-18", "agent-tool-call:t1"]);
  });

  it("falls back to name and time when the record has no id", () => {
    const built = rowsOf([withId(toolMessage("call", at(10, 1), "[Tool Call] run_workflow_wf1: {}"), "call_1")], [record("t1", at(10, 1))]);
    expect(built).toEqual(["day:2026-10-18", "agent-tool-call:t1"]);
  });

  it("pairs each record with one history chip only", () => {
    const built = rowsOf(
      [toolMessage("c1", at(10, 1), "[Tool Call] run_workflow_wf1: {}"), toolMessage("c2", at(10, 2), "[Tool Call] run_workflow_wf1: {}")],
      [record("t1", at(10, 1))],
    );
    expect(built).toEqual(["day:2026-10-18", "agent-tool-call:t1", "tool:c2"]);
  });
});
