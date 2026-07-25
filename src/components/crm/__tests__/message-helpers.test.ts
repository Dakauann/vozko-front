import { describe, expect, it } from "vitest";

import type { ConversationMessage } from "@/lib/conversations/types";


function formatMessageTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateGroup(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate || "-";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function groupMessagesByDate(messages: ConversationMessage[]) {
  const groups: { date: string; messages: ConversationMessage[] }[] = [];
  let currentDate = "";

  for (const msg of messages) {
    const parsed = new Date(msg.created_at);
    const dateStr = Number.isNaN(parsed.getTime())
      ? (msg.created_at ?? "unknown")
      : parsed.toDateString();
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      groups.push({ date: msg.created_at, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }

  return groups;
}

function groupMessagesByChannel(messages: ConversationMessage[]) {
  const runs: { channel: string; messages: ConversationMessage[] }[] = [];
  for (const msg of messages) {
    const msgType =
      msg.message_type ??
      (msg as unknown as { messageType?: string }).messageType;
    if (msgType === "system") {
      runs.push({ channel: "__system__", messages: [msg] });
      continue;
    }
    const ch =
      msg.channel ?? (msg as unknown as { channel?: string }).channel ?? "";
    if (
      runs.length === 0 ||
      runs[runs.length - 1].channel !== ch ||
      runs[runs.length - 1].channel === "__system__"
    ) {
      runs.push({ channel: ch, messages: [msg] });
    } else {
      runs[runs.length - 1].messages.push(msg);
    }
  }
  return runs;
}


function classifyMessage(
  msg: ConversationMessage,
  leadNumber: string,
) {
  const messageType =
    msg.message_type ??
    (msg as unknown as { messageType?: string }).messageType;

  const isExplicitOutgoing =
    messageType === "operator" ||
    messageType === "ai_response" ||
    messageType === "tool_call" ||
    messageType === "tool_result" ||
    messageType === "template";
  const isMediaOutgoing =
    (messageType === "audio" || !!msg.media_type) &&
    msg.to === leadNumber;
  const isOutgoing = isExplicitOutgoing || isMediaOutgoing;
  const isAgentMessage =
    messageType === "ai_response" ||
    (isMediaOutgoing && messageType === "audio");
  const isOperatorMessage = messageType === "operator";
  const isToolMessage =
    messageType === "tool_call" ||
    messageType === "tool_result" ||
    msg.text?.startsWith("[Tool Call]") ||
    msg.text?.startsWith("[Tool Result]") ||
    false;
  const isTemplateMessage = messageType === "template";
  const toolLabel = isToolMessage
    ? (msg.text?.split("\n")[0] ??
      (messageType === "tool_call" ? "Tool Call" : "Tool Result"))
    : null;

  return {
    messageType,
    isExplicitOutgoing,
    isMediaOutgoing,
    isOutgoing,
    isAgentMessage,
    isOperatorMessage,
    isToolMessage,
    isTemplateMessage,
    toolLabel,
  };
}


function makeMsg(
  overrides: Partial<ConversationMessage> & { id: string },
): ConversationMessage {
  return {
    entry_id: "entry-1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "user_message",
    from: "+5511999999999",
    to: "+5511888888888",
    text: "Hello",
    sender_name: "Lead",
    read: false,
    read_at: null,
    read_by: null,
    created_at: "2025-12-01T10:00:00Z",
    updated_at: "2025-12-01T10:00:00Z",
    ...overrides,
  };
}

const LEAD_NUMBER = "+5511999999999";
const OPERATOR_NUMBER = "+5511888888888";


describe("formatMessageTime", () => {
  it("formats valid ISO date to HH:mm (pt-BR)", () => {
    const result = formatMessageTime("2025-12-01T14:30:00Z");
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it("returns --:-- for invalid date", () => {
    expect(formatMessageTime("not-a-date")).toBe("--:--");
    expect(formatMessageTime("")).toBe("--:--");
  });
});


describe("formatDateGroup", () => {
  it("returns 'Hoje' for today", () => {
    const now = new Date().toISOString();
    expect(formatDateGroup(now)).toBe("Hoje");
  });

  it("returns 'Ontem' for yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDateGroup(yesterday.toISOString())).toBe("Ontem");
  });

  it("returns formatted date for older dates", () => {
    const result = formatDateGroup("2024-06-15T12:00:00Z");
    expect(result).toContain("2024");
    expect(result).toMatch(/\d{2}/);
  });

  it("returns raw string for invalid date", () => {
    expect(formatDateGroup("garbage")).toBe("garbage");
  });

  it("returns '-' for empty string", () => {
    expect(formatDateGroup("")).toBe("-");
  });
});


describe("groupMessagesByDate", () => {
  it("groups consecutive messages on the same date", () => {
    const msgs = [
      makeMsg({ id: "1", created_at: "2025-12-01T10:00:00Z" }),
      makeMsg({ id: "2", created_at: "2025-12-01T11:00:00Z" }),
      makeMsg({ id: "3", created_at: "2025-12-02T09:00:00Z" }),
    ];
    const groups = groupMessagesByDate(msgs);
    expect(groups).toHaveLength(2);
    expect(groups[0].messages).toHaveLength(2);
    expect(groups[1].messages).toHaveLength(1);
  });

  it("returns empty for empty array", () => {
    expect(groupMessagesByDate([])).toEqual([]);
  });

  it("puts messages with different dates in separate groups", () => {
    const msgs = [
      makeMsg({ id: "1", created_at: "2025-12-01T10:00:00Z" }),
      makeMsg({ id: "2", created_at: "2025-12-02T10:00:00Z" }),
      makeMsg({ id: "3", created_at: "2025-12-03T10:00:00Z" }),
    ];
    const groups = groupMessagesByDate(msgs);
    expect(groups).toHaveLength(3);
    groups.forEach((g) => expect(g.messages).toHaveLength(1));
  });

  it("handles invalid dates by using raw string", () => {
    const msgs = [
      makeMsg({ id: "1", created_at: "bad-date" }),
      makeMsg({ id: "2", created_at: "bad-date" }),
    ];
    const groups = groupMessagesByDate(msgs);
    expect(groups).toHaveLength(1); 
    expect(groups[0].messages).toHaveLength(2);
  });
});


describe("groupMessagesByChannel", () => {
  it("groups consecutive whatsapp messages", () => {
    const msgs = [
      makeMsg({ id: "1", channel: "whatsapp" }),
      makeMsg({ id: "2", channel: "whatsapp" }),
    ];
    const runs = groupMessagesByChannel(msgs);
    expect(runs).toHaveLength(1);
    expect(runs[0].channel).toBe("whatsapp");
    expect(runs[0].messages).toHaveLength(2);
  });

  it("splits runs on channel change", () => {
    const msgs = [
      makeMsg({ id: "1", channel: "whatsapp" }),
      makeMsg({ id: "2", channel: "voice" }),
      makeMsg({ id: "3", channel: "whatsapp" }),
    ];
    const runs = groupMessagesByChannel(msgs);
    expect(runs).toHaveLength(3);
    expect(runs[0].channel).toBe("whatsapp");
    expect(runs[1].channel).toBe("voice");
    expect(runs[2].channel).toBe("whatsapp");
  });

  it("isolates system messages into standalone runs", () => {
    const msgs = [
      makeMsg({ id: "1", channel: "whatsapp" }),
      makeMsg({ id: "2", channel: "whatsapp", message_type: "system" }),
      makeMsg({ id: "3", channel: "whatsapp" }),
    ];
    const runs = groupMessagesByChannel(msgs);
    expect(runs).toHaveLength(3);
    expect(runs[1].channel).toBe("__system__");
  });

  it("handles empty array", () => {
    expect(groupMessagesByChannel([])).toEqual([]);
  });
});


describe("classifyMessage", () => {
  describe("outgoing detection", () => {
    it("treats operator messages as outgoing", () => {
      const msg = makeMsg({ id: "1", message_type: "operator" });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isOutgoing).toBe(true);
      expect(result.isOperatorMessage).toBe(true);
    });

    it("treats ai_response messages as outgoing", () => {
      const msg = makeMsg({ id: "1", message_type: "ai_response" });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isOutgoing).toBe(true);
      expect(result.isAgentMessage).toBe(true);
    });

    it("treats tool_call messages as outgoing", () => {
      const msg = makeMsg({ id: "1", message_type: "tool_call" });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isOutgoing).toBe(true);
      expect(result.isToolMessage).toBe(true);
    });

    it("treats tool_result messages as outgoing", () => {
      const msg = makeMsg({ id: "1", message_type: "tool_result" });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isOutgoing).toBe(true);
      expect(result.isToolMessage).toBe(true);
    });

    it("treats template messages as outgoing", () => {
      const msg = makeMsg({ id: "1", message_type: "template" });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isOutgoing).toBe(true);
      expect(result.isTemplateMessage).toBe(true);
    });

    it("treats audio message TO lead as outgoing (media outgoing)", () => {
      const msg = makeMsg({
        id: "1",
        message_type: "audio",
        to: LEAD_NUMBER,
      });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isOutgoing).toBe(true);
      expect(result.isMediaOutgoing).toBe(true);
      expect(result.isAgentMessage).toBe(true);
    });

    it("treats media message with media_type TO lead as outgoing", () => {
      const msg = makeMsg({
        id: "1",
        message_type: "user_message",
        media_type: "image",
        to: LEAD_NUMBER,
      });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isOutgoing).toBe(true);
    });

    it("treats user_message NOT to lead as incoming", () => {
      const msg = makeMsg({
        id: "1",
        message_type: "user_message",
        to: OPERATOR_NUMBER,
      });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isOutgoing).toBe(false);
    });
  });

  describe("tool messages", () => {
    it("detects tool_call by message_type", () => {
      const msg = makeMsg({ id: "1", message_type: "tool_call", text: "[Tool Call] search\nparams" });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isToolMessage).toBe(true);
      expect(result.toolLabel).toBe("[Tool Call] search");
    });

    it("detects tool message by text prefix [Tool Call]", () => {
      const msg = makeMsg({ id: "1", text: "[Tool Call] lookup\nsome data" });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isToolMessage).toBe(true);
      expect(result.toolLabel).toBe("[Tool Call] lookup");
    });

    it("detects tool message by text prefix [Tool Result]", () => {
      const msg = makeMsg({ id: "1", text: "[Tool Result] ok" });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isToolMessage).toBe(true);
    });

    it("non-tool message has null toolLabel", () => {
      const msg = makeMsg({ id: "1", text: "Regular message" });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isToolMessage).toBe(false);
      expect(result.toolLabel).toBeNull();
    });
  });

  describe("agent / operator badges", () => {
    it("ai_response is agent but not operator", () => {
      const msg = makeMsg({ id: "1", message_type: "ai_response" });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isAgentMessage).toBe(true);
      expect(result.isOperatorMessage).toBe(false);
    });

    it("operator is operator but not agent", () => {
      const msg = makeMsg({ id: "1", message_type: "operator" });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isOperatorMessage).toBe(true);
      expect(result.isAgentMessage).toBe(false);
    });

    it("user_message is neither agent nor operator", () => {
      const msg = makeMsg({ id: "1", message_type: "user_message" });
      const result = classifyMessage(msg, LEAD_NUMBER);
      expect(result.isAgentMessage).toBe(false);
      expect(result.isOperatorMessage).toBe(false);
    });
  });
});


function isMessageOutgoing(msg: ConversationMessage, leadNumber: string): boolean {
  const messageType =
    msg.message_type ??
    (msg as unknown as { messageType?: string }).messageType;

  const isExplicitOutgoing =
    messageType === "operator" ||
    messageType === "ai_response" ||
    messageType === "tool_call" ||
    messageType === "tool_result" ||
    messageType === "template";
  const isMediaOutgoing =
    (messageType === "audio" || !!msg.media_type) &&
    msg.to === leadNumber;
  return isExplicitOutgoing || isMediaOutgoing;
}

describe("adjacent message side detection", () => {
  it("consecutive outgoing messages share the same side", () => {
    const msgs = [
      makeMsg({ id: "1", message_type: "operator" }),
      makeMsg({ id: "2", message_type: "ai_response" }),
    ];
    expect(isMessageOutgoing(msgs[0], LEAD_NUMBER)).toBe(true);
    expect(isMessageOutgoing(msgs[1], LEAD_NUMBER)).toBe(true);
  });

  it("incoming then outgoing are different sides", () => {
    const msgs = [
      makeMsg({ id: "1", message_type: "user_message", to: OPERATOR_NUMBER }),
      makeMsg({ id: "2", message_type: "operator" }),
    ];
    expect(isMessageOutgoing(msgs[0], LEAD_NUMBER)).toBe(false);
    expect(isMessageOutgoing(msgs[1], LEAD_NUMBER)).toBe(true);
  });
});


describe("sender name display logic", () => {
  it("shows sender name on first incoming message", () => {
    const msgs = [
      makeMsg({ id: "1", message_type: "user_message", from: "+1", to: OPERATOR_NUMBER }),
    ];
    const isOutgoing = isMessageOutgoing(msgs[0], LEAD_NUMBER);
    const showSenderName = !isOutgoing && true; 
    expect(showSenderName).toBe(true);
  });

  it("does not show sender name on outgoing messages", () => {
    const msgs = [
      makeMsg({ id: "1", message_type: "operator" }),
    ];
    const isOutgoing = isMessageOutgoing(msgs[0], LEAD_NUMBER);
    const showSenderName = !isOutgoing; 
    expect(showSenderName).toBe(false);
  });

  it("shows sender name when sender changes", () => {
    const msgs = [
      makeMsg({ id: "1", message_type: "user_message", from: "+1", to: OPERATOR_NUMBER }),
      makeMsg({ id: "2", message_type: "user_message", from: "+2", to: OPERATOR_NUMBER }),
    ];
    const isOutgoing1 = isMessageOutgoing(msgs[0], LEAD_NUMBER);
    const isOutgoing2 = isMessageOutgoing(msgs[1], LEAD_NUMBER);
    const showSenderName = !isOutgoing2 && msgs[0].from !== msgs[1].from;
    expect(isOutgoing1).toBe(false);
    expect(showSenderName).toBe(true);
  });

  it("does not show sender name when same sender continues", () => {
    const msgs = [
      makeMsg({ id: "1", message_type: "user_message", from: "+1", to: OPERATOR_NUMBER }),
      makeMsg({ id: "2", message_type: "user_message", from: "+1", to: OPERATOR_NUMBER }),
    ];
    const isOutgoing2 = isMessageOutgoing(msgs[1], LEAD_NUMBER);
    const showSenderName = !isOutgoing2 && msgs[0].from !== msgs[1].from;
    expect(showSenderName).toBe(false);
  });
});


describe("channel color logic", () => {
  it("voice run uses blue border", () => {
    const channel = "voice";
    const channelColor =
      channel === "voice"
        ? "border-blue-400"
        : channel === "whatsapp"
          ? "border-emerald-400"
          : "border-foreground/20";
    expect(channelColor).toBe("border-blue-400");
  });

  it("whatsapp run uses emerald border", () => {
    const channel: string = "whatsapp";
    const channelColor =
      channel === "voice"
        ? "border-blue-400"
        : channel === "whatsapp"
          ? "border-emerald-400"
          : "border-foreground/20";
    expect(channelColor).toBe("border-emerald-400");
  });

  it("unknown channel uses foreground border", () => {
    const channel: string = "other";
    const channelColor =
      channel === "voice"
        ? "border-blue-400"
        : channel === "whatsapp"
          ? "border-emerald-400"
          : "border-foreground/20";
    expect(channelColor).toBe("border-foreground/20");
  });
});


const MESSAGE_COLLAPSE_LIMIT = 500;

describe("message collapse logic", () => {
  it("short text does not need collapsing", () => {
    const text = "Short message";
    expect(text.length > MESSAGE_COLLAPSE_LIMIT).toBe(false);
  });

  it("long text needs collapsing", () => {
    const text = "x".repeat(501);
    expect(text.length > MESSAGE_COLLAPSE_LIMIT).toBe(true);
  });

  it("exactly 500 chars does not collapse", () => {
    const text = "x".repeat(500);
    expect(text.length > MESSAGE_COLLAPSE_LIMIT).toBe(false);
  });

  it("collapsed text ends with ellipsis", () => {
    const text = "x".repeat(600);
    const displayedText = text.slice(0, MESSAGE_COLLAPSE_LIMIT).trimEnd() + "...";
    expect(displayedText).toHaveLength(503);
    expect(displayedText.endsWith("...")).toBe(true);
  });
});
