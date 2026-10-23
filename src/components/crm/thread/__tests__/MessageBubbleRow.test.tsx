import { render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ThreadPerspective } from "@/lib/conversations/bubble-side";
import type { ConversationMessage } from "@/lib/conversations/types";
import type { ThreadRow } from "@/lib/conversations/thread-rows";

import { MessageBubbleRow } from "../MessageBubbleRow";
import { ThreadRowProvider, type ThreadRowContextValue } from "../thread-context";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => true }) }));
vi.mock("@/app/actions/conversations", () => ({ getConversationMediaAction: vi.fn() }));

const workflowLabel = ptMessages.crm.messageSender.workflow;

function msg(overrides: Partial<ConversationMessage> & { sent_by?: { kind: string; id: string } }): ConversationMessage {
  return {
    id: "m-1",
    entry_id: "entry-1",
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
    sent_by: { kind: "workflow", id: "wf-1" },
    created_at: "2026-10-20T12:00:00Z",
    updated_at: "2026-10-20T12:00:00Z",
    ...overrides,
  } as ConversationMessage;
}

const OUTBOUND = msg({});
const INBOUND = msg({ id: "in-1", direction: "INBOUND", message_type: "user_message", from: "5511999990000", to: "business", text: "Ola", sent_by: { kind: "contact", id: "5511999990000" } });

function renderBubble(message: ConversationMessage, outgoing: boolean, extra: Partial<ThreadRowContextValue> = {}) {
  const context: ThreadRowContextValue = {
    conversation: { entry_id: "entry-1", entry_type: "whatsapp", lead_name: "", lead_number: "5511999990000", messages: [message], has_more: false, unread_count: 0, window_open: true, window_expires_at: null },
    messagesById: new Map([[message.id, message]]),
    matchedIds: new Set(),
    currentMatchId: null,
    arrivalStart: () => false,
    canSeekOriginal: false,
    onJumpToMessage: () => {},
    resendingIds: new Set(),
    toolDefinitions: new Map(),
    toolCopy: { ...ptMessages.crmConversation.thread.tool, imageSentTo: (recipient: string) => recipient },
    ...extra,
  };
  const row: Extract<ThreadRow, { kind: "message" }> = {
    kind: "message",
    key: message.id,
    message,
    outgoing,
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

function rowOf(container: HTMLElement, id: string) {
  return container.querySelector<HTMLElement>(`[data-msg-id="${id}"]`)!;
}

function bubbleOf(container: HTMLElement) {
  return container.querySelector<HTMLElement>("[data-bubble]")!;
}

const customerLabels = (message: ConversationMessage) => (message.direction === "INBOUND" ? "Você (cliente)" : "Enviar Texto");

describe("MessageBubbleRow in the CRM conversation", () => {
  it("keeps what the business sent on the right, in the sent style, with its sender chip and delivery ticks", () => {
    const { container } = renderBubble(OUTBOUND, true);
    expect(rowOf(container, "m-1").className).toContain("justify-end");
    expect(bubbleOf(container).className).toContain("bg-[#d9fdd3]");
    expect(screen.getByText(workflowLabel)).toBeInTheDocument();
    expect(bubbleOf(container).querySelectorAll("svg")).toHaveLength(1);
  });

  it("keeps the contact on the left, in the received style, under its number and without ticks", () => {
    const { container } = renderBubble(INBOUND, false);
    expect(rowOf(container, "in-1").className).toContain("justify-start");
    expect(bubbleOf(container).className).toContain("bg-card");
    expect(screen.getByText("5511999990000")).toBeInTheDocument();
    expect(bubbleOf(container).querySelectorAll("svg")).toHaveLength(0);
  });

  it("renders the same with the business perspective named explicitly", () => {
    const perspective: ThreadPerspective = "business";
    const { container } = renderBubble(OUTBOUND, true, { perspective });
    expect(rowOf(container, "m-1").className).toContain("justify-end");
    expect(bubbleOf(container).querySelectorAll("svg")).toHaveLength(1);
  });
});

describe("MessageBubbleRow from the customer's perspective", () => {
  it("puts what the workflow sent on the left in the received style, labelled by its source, without the business chip or ticks", () => {
    const { container } = renderBubble(OUTBOUND, true, { perspective: "customer", senderLabel: customerLabels });
    expect(rowOf(container, "m-1").className).toContain("justify-start");
    expect(bubbleOf(container).className).toContain("bg-card");
    expect(screen.getByText("Enviar Texto")).toBeInTheDocument();
    expect(screen.queryByText(workflowLabel)).toBeNull();
    expect(bubbleOf(container).querySelectorAll("svg")).toHaveLength(0);
  });

  it("puts the customer's own message on the right in the own style, named as the customer instead of the number", () => {
    const { container } = renderBubble(INBOUND, false, { perspective: "customer", senderLabel: customerLabels });
    expect(rowOf(container, "in-1").className).toContain("justify-end");
    expect(bubbleOf(container).className).toContain("bg-[#d9fdd3]");
    expect(screen.getByText("Você (cliente)")).toBeInTheDocument();
    expect(screen.queryByText("5511999990000")).toBeNull();
    expect(bubbleOf(container).querySelectorAll("svg")).toHaveLength(0);
  });
});

describe("MessageBubbleRow campaign badge on email", () => {
  const campaignEmail = (metadata?: Record<string, unknown>) =>
    msg({ id: "em-1", entry_type: "email", channel: "email", message_type: "operator", sent_by: { kind: "campaign", id: "camp-1" }, metadata: metadata as ConversationMessage["metadata"] });

  it("names the campaign in the badge of an email campaign row", () => {
    renderBubble(campaignEmail({ email_campaign_name: "Black Friday" }), true);
    expect(screen.getByText("Campanha: Black Friday")).toBeInTheDocument();
  });

  it("keeps the plain campaign badge when the row carries no name", () => {
    renderBubble(campaignEmail({}), true);
    expect(screen.getByText(ptMessages.crm.messageSender.campaign)).toBeInTheDocument();
  });
});
