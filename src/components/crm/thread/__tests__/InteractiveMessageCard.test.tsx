import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { InteractiveChoice } from "@/lib/conversations/interactive-message";
import type { ConversationMessage } from "@/lib/conversations/types";
import type { ThreadRow } from "@/lib/conversations/thread-rows";

import { MessageBubbleRow } from "../MessageBubbleRow";
import { ThreadRowProvider, type ThreadRowContextValue } from "../thread-context";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => true }) }));
vi.mock("@/app/actions/conversations", () => ({ getConversationMediaAction: vi.fn() }));

const copy = ptMessages.crmConversation.thread.interactive;

function msg(metadata: Record<string, unknown>): ConversationMessage {
  return {
    id: "m-1",
    entry_id: "entry-1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "ai_response",
    direction: "OUTBOUND",
    from: "business",
    to: "contact",
    text: "Quer continuar a matrícula?",
    sender_name: "",
    read: false,
    read_at: null,
    read_by: null,
    metadata: metadata as unknown as ConversationMessage["metadata"],
    created_at: "2026-10-20T12:00:00Z",
    updated_at: "2026-10-20T12:00:00Z",
  };
}

function renderBubble(message: ConversationMessage, onChooseOption?: (choice: InteractiveChoice) => void) {
  const context: ThreadRowContextValue = {
    conversation: { entry_id: "entry-1", entry_type: "whatsapp", lead_name: "", lead_number: "", messages: [message], has_more: false, unread_count: 0, window_open: true, window_expires_at: null },
    messagesById: new Map([[message.id, message]]),
    matchedIds: new Set(),
    currentMatchId: null,
    arrivalStart: () => false,
    canSeekOriginal: false,
    onJumpToMessage: () => {},
    resendingIds: new Set(),
    toolDefinitions: new Map(),
    toolCopy: { ...ptMessages.crmConversation.thread.tool, imageSentTo: (recipient: string) => recipient },
    onChooseOption,
  };
  const row: Extract<ThreadRow, { kind: "message" }> = {
    kind: "message",
    key: message.id,
    message,
    outgoing: true,
    groupPosition: "single",
    channelRunStart: false,
    runGap: false,
  };
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
        <ThreadRowProvider value={context}>{children}</ThreadRowProvider>
      </NextIntlClientProvider>
    );
  }
  return rtlRender(<MessageBubbleRow row={row} />, { wrapper: Wrapper });
}

const BUTTONS = {
  buttons: {
    header_text: "Matrícula",
    body_text: "Quer continuar a matrícula?",
    footer_text: "Responda abaixo",
    buttons: [
      { id: "sim", title: "Sim" },
      { id: "nao", title: "Não" },
    ],
  },
};

const LIST = {
  list: {
    body_text: "Quer continuar a matrícula?",
    button_text: "Ver turnos",
    sections: [{ title: "Presencial", rows: [{ id: "manha", title: "Manhã", description: "8h às 12h" }] }],
  },
};

describe("interactive messages in the conversation", () => {
  it("shows the header, the body, the footer and the reply buttons the contact sees", () => {
    renderBubble(msg(BUTTONS));
    expect(screen.getByText("Matrícula")).toBeInTheDocument();
    expect(screen.getByText("Quer continuar a matrícula?")).toBeInTheDocument();
    expect(screen.getByText("Responda abaixo")).toBeInTheDocument();
    const yes = screen.getByRole("button", { name: "Sim" });
    expect(yes).toBeDisabled();
    expect(yes).toHaveAttribute("title", copy.choiceHint);
  });

  it("sends the tapped button as a choice when the thread accepts one", () => {
    const onChooseOption = vi.fn();
    renderBubble(msg(BUTTONS), onChooseOption);
    fireEvent.click(screen.getByRole("button", { name: "Não" }));
    expect(onChooseOption).toHaveBeenCalledWith({ kind: "button", id: "nao", title: "Não" });
  });

  it("opens a list from its button and sends the tapped row", () => {
    const onChooseOption = vi.fn();
    renderBubble(msg(LIST), onChooseOption);
    const opener = screen.getByRole("button", { name: "Ver turnos" });
    expect(opener).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Presencial")).toBeNull();

    fireEvent.click(opener);
    expect(opener).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Presencial")).toBeInTheDocument();
    expect(screen.getByText("8h às 12h")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Manhã/ }));
    expect(onChooseOption).toHaveBeenCalledWith({ kind: "list", id: "manha", title: "Manhã", description: "8h às 12h" });
  });

  it("lets an operator read the list rows without choosing them", () => {
    renderBubble(msg(LIST));
    fireEvent.click(screen.getByRole("button", { name: "Ver turnos" }));
    expect(screen.getByRole("button", { name: /Manhã/ })).toBeDisabled();
  });

  it("names the list button when the message has no button text", () => {
    renderBubble(msg({ list: { body_text: "x", sections: [{ rows: [{ id: "a", title: "A" }] }] } }));
    expect(screen.getByRole("button", { name: copy.listFallback })).toBeInTheDocument();
  });
});
