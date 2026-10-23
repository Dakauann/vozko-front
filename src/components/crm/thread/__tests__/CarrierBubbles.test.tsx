import { render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import rawPt from "@/i18n/messages/pt.json";
import { carouselFixture } from "@/lib/rcs/test-fixtures";
import { brandedMessages } from "@/test/branded-messages";
import type { ConversationMessage } from "@/lib/conversations/types";
import type { ThreadRow } from "@/lib/conversations/thread-rows";

import { MessageBubbleRow } from "../MessageBubbleRow";
import { ThreadRowProvider, type ThreadRowContextValue } from "../thread-context";

const ptMessages = brandedMessages(rawPt);

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => true }) }));
vi.mock("@/app/actions/conversations", () => ({ getConversationMediaAction: vi.fn() }));

function msg(overrides: Partial<ConversationMessage>): ConversationMessage {
  return {
    id: "m-1",
    entry_id: "entry-1",
    entry_type: "rcs",
    channel: "rcs",
    message_type: "user_message",
    from: "agent",
    to: "+5511999990000",
    text: "Olá",
    sender_name: "Comprador",
    read: true,
    read_at: null,
    read_by: null,
    created_at: "2026-10-19T10:00:00Z",
    updated_at: "2026-10-19T10:00:00Z",
    ...overrides,
  };
}

function context(message: ConversationMessage): ThreadRowContextValue {
  return {
    conversation: {
      entry_id: "entry-1",
      entry_type: message.entry_type,
      lead_name: "Comprador",
      lead_number: "",
      messages: [message],
      has_more: false,
      unread_count: 0,
      window_open: true,
      window_expires_at: null,
    },
    messagesById: new Map([[message.id, message]]),
    matchedIds: new Set(),
    currentMatchId: null,
    arrivalStart: () => false,
    canSeekOriginal: false,
    onJumpToMessage: () => {},
    resendingIds: new Set(),
    toolDefinitions: new Map(),
    toolCopy: { ...ptMessages.crmConversation.thread.tool, imageSentTo: (recipient: string) => recipient },
  };
}

function wrapperFor(message: ConversationMessage) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThreadRowProvider value={context(message)}>{children}</ThreadRowProvider>
      </NextIntlClientProvider>
    );
  };
}

function renderBubble(message: ConversationMessage, outgoing: boolean) {
  const row: Extract<ThreadRow, { kind: "message" }> = {
    kind: "message",
    key: message.id,
    message,
    outgoing,
    groupPosition: "single",
    channelRunStart: false,
    runGap: false,
  };
  return rtlRender(<MessageBubbleRow row={row} />, { wrapper: wrapperFor(message) });
}

describe("RCS and SMS bubbles", () => {
  it("draws an RCS carousel from the transcript content instead of the plain preview text", () => {
    renderBubble(
      msg({
        message_type: "template",
        text: "Pão de fermentação natural",
        metadata: { rcs: { reference: "ref", step: "rcs", class: "single", content: carouselFixture() } } as never,
      }),
      true,
    );
    expect(screen.getByRole("list", { name: "Carrossel com 2 cartões" })).toBeInTheDocument();
    expect(screen.getByText("Café da manhã completo")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: ptMessages.rcs.preview.suggestions })).toBeInTheDocument();
  });

  it("keeps the text and adds the reply chips of an RCS text message", () => {
    renderBubble(
      msg({ message_type: "operator", text: "Seu pedido saiu", metadata: { rcs: { content: { text: "Seu pedido saiu", suggestions: [{ kind: "reply", label: "Obrigado" }] } } } as never }),
      true,
    );
    expect(screen.getByText("Seu pedido saiu")).toBeInTheDocument();
    expect(screen.getByText("Obrigado")).toBeInTheDocument();
  });

  it("falls back to the plain text when the RCS content cannot be read", () => {
    renderBubble(msg({ text: "Texto puro", metadata: { rcs: { content: { cards: "quebrado" } } } as never }), true);
    expect(screen.getByText("Texto puro")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("shows how many parts an SMS used", () => {
    renderBubble(msg({ entry_type: "sms", channel: "sms", text: "Loja: Oi", metadata: { sms: { reference: "ref", step: "sms", segments: 2 } } as never }), true);
    expect(screen.getByText("Loja: Oi")).toBeInTheDocument();
    expect(screen.getByText("2 partes de SMS")).toBeInTheDocument();
  });
});
