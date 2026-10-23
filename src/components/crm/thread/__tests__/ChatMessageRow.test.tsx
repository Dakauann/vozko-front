import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { GroupPosition } from "@/lib/chat/message-groups";
import type { ConversationMessage } from "@/lib/conversations/types";

import { ChatMessageRow } from "../ChatMessageRow";
import { READ_ONLY_THREAD_ROW, ThreadRowProvider, type ThreadRowContextValue } from "../thread-context";

vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => true }) }));
vi.mock("@/app/actions/conversations", () => ({ getConversationMediaAction: vi.fn() }));

function msg(overrides: Partial<ConversationMessage>): ConversationMessage {
  return {
    id: "out-1",
    entry_id: "sim-entry",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "ai_response",
    direction: "OUTBOUND",
    from: "business",
    to: "5511999990000",
    text: "Bem-vindo",
    sender_name: "",
    read: false,
    read_at: null,
    read_by: null,
    delivery_status: "sent",
    created_at: "2026-10-20T12:00:00Z",
    updated_at: "2026-10-20T12:00:00Z",
    ...overrides,
  } as ConversationMessage;
}

const WORKFLOW = msg({});
const CUSTOMER = msg({ id: "in-1", direction: "INBOUND", message_type: "user_message", from: "5511999990000", to: "business", text: "Quero me matricular" });
const BUTTONS = msg({ id: "out-2", metadata: { buttons: { body_text: "Continuar?", buttons: [{ id: "sim", title: "Sim" }] } } as unknown as ConversationMessage["metadata"] });

function renderRow(message: ConversationMessage, position: GroupPosition, extra: Partial<ThreadRowContextValue> = {}) {
  const context: ThreadRowContextValue = {
    ...READ_ONLY_THREAD_ROW,
    conversation: { entry_id: "sim-entry", entry_type: "whatsapp", lead_name: "", lead_number: "", messages: [], has_more: false, unread_count: 0, window_open: true, window_expires_at: null },
    messagesById: new Map([[message.id, message]]),
    onJumpToMessage: () => {},
    toolCopy: { ...ptMessages.crmConversation.thread.tool, imageSentTo: (recipient: string) => recipient },
    perspective: "customer",
    senderLabel: (m) => (m.direction === "INBOUND" ? "Você (cliente)" : "Boas-vindas"),
    ...extra,
  };
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
        <ThreadRowProvider value={context}>{children}</ThreadRowProvider>
      </NextIntlClientProvider>
    );
  }
  const row = { kind: "message" as const, key: message.id, message, outgoing: message.direction === "OUTBOUND", groupPosition: position, channelRunStart: false, runGap: false };
  const view = render(<ChatMessageRow row={row} />, { wrapper: Wrapper });
  const rowElement = view.container.querySelector<HTMLElement>(`[data-msg-id="${message.id}"]`)!;
  return { row: rowElement, bubble: rowElement.querySelector<HTMLElement>("[data-bubble]")! };
}

describe("ChatMessageRow in the team chat language", () => {
  it("puts the tester's own message on the right as a graphite bubble, without a name, its rich content in the inverted palette", () => {
    const { row, bubble } = renderRow(CUSTOMER, "single");
    expect(row.className).toContain("justify-end");
    expect(bubble.className).toContain("bg-foreground text-background");
    expect(screen.queryByText("Você (cliente)")).toBeNull();
    expect(screen.getByText("Quero me matricular").closest(".vz-inverse")).not.toBeNull();
  });

  it("puts what the workflow sent on the left as a card bubble named after its source at the head of a stack", () => {
    const { row, bubble } = renderRow(WORKFLOW, "first");
    expect(row.className).toContain("justify-start");
    expect(bubble.className).toContain("border border-border bg-card text-foreground");
    expect(bubble.className).toContain("rounded-bl-sm");
    expect(screen.getByText("Boas-vindas")).toBeInTheDocument();
  });

  it("shows the source only once per stack, the way the team chat names an author once", () => {
    const { bubble } = renderRow(WORKFLOW, "last");
    expect(bubble.className).toContain("rounded-tl-sm");
    expect(screen.queryByText("Boas-vindas")).toBeNull();
  });

  it("draws no delivery ticks on either side", () => {
    expect(renderRow(WORKFLOW, "single").bubble.querySelectorAll("svg")).toHaveLength(0);
  });

  it("keeps interactive choices clickable when the conversation offers a choice", () => {
    const onChooseOption = vi.fn();
    renderRow(BUTTONS, "single", { onChooseOption });
    fireEvent.click(screen.getByRole("button", { name: "Sim" }));
    expect(onChooseOption).toHaveBeenCalledWith({ kind: "button", id: "sim", title: "Sim" });
  });
});
