import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { conversationDrafts } from "@/lib/conversations/browser-drafts";
import type { InboxEntry } from "@/lib/conversations/types";
import { reduceTyping, emptyTyping, type TypingState } from "@/lib/conversations/typing";

const crm = vi.hoisted(() => ({ typing: null as TypingState | null }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => false, currentWorkspace: { id: "ws-1" } }),
}));
vi.mock("@/contexts/auth-context", () => ({ useSignedInUserId: () => "user-1" }));
vi.mock("@/contexts/crm-context", () => ({
  useOptionalCrm: () => (crm.typing ? { typingByEntry: crm.typing } : null),
}));
vi.mock("@/app/actions/workspace", () => ({ listAssignableMembersAction: vi.fn(async () => ({ members: [] })) }));
vi.mock("@/i18n/routing", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/dashboard/NoDepartmentNotice", () => ({
  useBlockedByMissingDepartment: () => false,
  NoDepartmentNotice: () => null,
}));
vi.mock("@/components/crm/InboxEntryContextMenu", () => ({
  InboxEntryContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  InboxEntryMenuButton: () => null,
}));

import CrmInbox from "../CrmInbox";

const rowT = ptMessages.crmComposer.inboxRow;
const scope = { workspaceId: "ws-1", userId: "user-1" };

const ana = {
  entry_id: "a",
  entry_type: "whatsapp",
  lead_name: "Ana",
  lead_number: "5511999990000",
  last_message_at: "2026-10-18T12:00:00Z",
  last_message_preview: "pode me ligar?",
  unread_count: 0,
  conversation_status: "ongoing",
} as InboxEntry;

function renderInbox(entries: InboxEntry[] = [ana]) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CrmInbox entries={entries} selectedEntryId={null} onSelect={vi.fn()} connectionStatus="connected" translations={ptMessages.liveChat.inbox} />
    </NextIntlClientProvider>,
  );
}

const senders = ptMessages.crm.messageSender;

beforeEach(() => {
  window.localStorage.clear();
  crm.typing = null;
});

describe("inbox row preview", () => {
  it("shows the last message when there is no draft", () => {
    renderInbox();
    expect(screen.getByText("pode me ligar?")).toBeInTheDocument();
  });

  it("shows the operator's draft instead of the last message", () => {
    conversationDrafts.write(scope, "whatsapp-a", { text: "Ligo às 15h", attachments: [] });
    renderInbox();
    expect(screen.getByText(rowT.draft)).toBeInTheDocument();
    expect(screen.getByText(/Ligo às 15h/)).toBeInTheDocument();
    expect(screen.queryByText("pode me ligar?")).not.toBeInTheDocument();
  });

  it("follows the draft as it is saved and cleared", () => {
    renderInbox();
    act(() => conversationDrafts.write(scope, "whatsapp-a", { text: "Já volto", attachments: [] }));
    expect(screen.getByText(/Já volto/)).toBeInTheDocument();
    act(() => conversationDrafts.clear(scope, "whatsapp-a"));
    expect(screen.getByText("pode me ligar?")).toBeInTheDocument();
  });

  it("names a Mercado Livre reply written in the Mercado Livre app", () => {
    renderInbox([{ ...ana, entry_type: "mercadolivre", last_message_preview: "Já enviei", last_message_sender_kind: "external" }]);
    expect(screen.getByText(`${senders.externalVia.mercadolivre}: Já enviei`)).toBeInTheDocument();
  });

  it("names a WhatsApp reply typed on the phone the way the thread does", () => {
    renderInbox([{ ...ana, last_message_preview: "Te ligo já", last_message_sender_kind: "external" }]);
    expect(screen.getByText(`${senders.external}: Te ligo já`)).toBeInTheDocument();
  });

  it("names the team and automations, and never the contact", () => {
    renderInbox([
      { ...ana, entry_id: "b", last_message_preview: "Posso ajudar?", last_message_sender_kind: "ai" },
      { ...ana, entry_id: "c", last_message_preview: "Oi!", last_message_sender_kind: "contact" },
    ]);
    expect(screen.getByText(`${senders.ai}: Posso ajudar?`)).toBeInTheDocument();
    expect(screen.getByText("Oi!")).toBeInTheDocument();
  });

  it("says someone is typing in that conversation", () => {
    conversationDrafts.write(scope, "whatsapp-a", { text: "Ligo às 15h", attachments: [] });
    crm.typing = reduceTyping(emptyTyping, { type: "typing", entryId: "a", entryType: "whatsapp", userId: "lead", isTyping: true });
    renderInbox();
    expect(screen.getByText(rowT.typing)).toBeInTheDocument();
  });
});
