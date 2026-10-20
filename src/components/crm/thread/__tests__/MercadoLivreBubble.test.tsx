import { render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ConversationMessage } from "@/lib/conversations/types";
import type { ThreadRow } from "@/lib/conversations/thread-rows";

import { UnsupportedRow } from "../event-rows";
import { MessageBubbleRow } from "../MessageBubbleRow";
import { ThreadRowProvider, type ThreadRowContextValue } from "../thread-context";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => true }) }));
vi.mock("@/app/actions/conversations", () => ({ getConversationMediaAction: vi.fn() }));

const copy = ptMessages.mercadolivre.thread;

function msg(overrides: Partial<ConversationMessage>): ConversationMessage {
  return {
    id: "m-1",
    entry_id: "entry-1",
    entry_type: "mercadolivre",
    channel: "mercadolivre",
    message_type: "user_message",
    from: "buyer",
    to: "seller",
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
      entry_type: "mercadolivre",
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

describe("Mercado Livre bubbles", () => {
  it("shows the moderation state and reason on an outbound message", () => {
    renderBubble(
      msg({
        message_type: "operator",
        sent_by: { kind: "human", id: "u-1" },
        delivery_status: "failed",
        metadata: { mercadolivre_moderation: { status: "rejected", reason: "PERSONAL_DATA" } } as never,
      }),
      true,
    );
    expect(screen.getByText(copy.moderation.blocked)).toBeInTheDocument();
    expect(screen.getByText(copy.moderationReason.PERSONAL_DATA)).toBeInTheDocument();
  });

  it("labels a reply sent from the Mercado Livre app from its external sender alone, with no stored name", () => {
    renderBubble(msg({ message_type: "operator", sent_by: { kind: "external", id: "" }, sender_name: "", from: "" }), true);
    expect(screen.getByText(ptMessages.crm.messageSender.externalVia.mercadolivre)).toBeInTheDocument();
    expect(screen.queryByText(ptMessages.crm.messageSender.external)).not.toBeInTheDocument();
  });

  it("keeps the phone label for external replies on WhatsApp", () => {
    renderBubble(
      msg({ entry_type: "whatsapp", channel: "whatsapp", message_type: "operator", sent_by: { kind: "external", id: "" } }),
      true,
    );
    expect(screen.getByText(ptMessages.crm.messageSender.external)).toBeInTheDocument();
  });

  it("names the channel's own app for an external reply on Instagram", () => {
    renderBubble(
      msg({ entry_type: "instagram", channel: "instagram", message_type: "operator", sent_by: { kind: "external", id: "" } }),
      true,
    );
    expect(screen.getByText(ptMessages.crm.messageSender.externalVia.instagram)).toBeInTheDocument();
  });

  it("marks a buyer message relayed by the Mercado Livre agent", () => {
    renderBubble(msg({ sent_by: { kind: "contact", id: "3037675074" }, metadata: { mercadolivre_from_agent: true } as never }), false);
    expect(screen.getByText(copy.fromAgent)).toBeInTheDocument();
  });

  it("replaces the raw unavailable attachment text with the localized marker", () => {
    const message = msg({
      message_type: "unsupported",
      text: "[anexo indisponível]",
      metadata: { mercadolivre_media_unavailable: true, mercadolivre_file_name: "nota.pdf" } as never,
    });
    rtlRender(<UnsupportedRow row={{ kind: "unsupported", key: message.id, message, runGap: false }} />, { wrapper: wrapperFor(message) });
    expect(screen.getByText("Anexo indisponível: nota.pdf")).toBeInTheDocument();
    expect(screen.queryByText("[anexo indisponível]")).not.toBeInTheDocument();
  });
});
