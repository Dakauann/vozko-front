import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ActiveConversation, ConversationMessage } from "@/lib/conversations/types";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));

const mocks = vi.hoisted(() => ({
  createNote: vi.fn(),
  crm: { activeConversation: null as ActiveConversation | null, windowConversations: new Map(), runMessageAction: vi.fn(() => true) },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/actions/conversations", () => ({ uploadConversationMediaAction: vi.fn() }));
vi.mock("@/app/actions/message-shortcuts", () => ({ listMessageShortcutsAction: vi.fn().mockResolvedValue({ shortcuts: [] }) }));
vi.mock("@/app/actions/conversation-notes", () => ({ createConversationNoteAction: mocks.createNote, listConversationNotesAction: vi.fn() }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => true, currentWorkspace: { id: "ws-1" } }) }));
vi.mock("@/contexts/auth-context", () => ({ useSignedInUserId: () => "user-ana", useSignedInUserName: () => "Ana" }));
vi.mock("@/contexts/crm-context", () => ({ useOptionalCrm: () => mocks.crm }));
vi.mock("@/hooks/use-shortcut-variable-values", () => ({ useShortcutVariableValues: () => ({}) }));
vi.mock("@/hooks/use-assignable-members", () => ({
  memberDisplayName: (member: { username: string }) => member.username,
  useAssignableMembers: () => ({
    members: [
      { userId: "user-bruno", username: "Bruno Lima" },
      { userId: "user-carla", username: "Carla" },
    ],
    names: new Map(),
  }),
}));

import CrmMessageInput from "../CrmMessageInput";
import { editingMessageOf, stopEditing } from "@/hooks/use-message-editing";

const copy = ptMessages.crmMessage.composer;
const inputT = ptMessages.whatsappCampaignsPage.detail.crm.input;
const ENTRY_KEY = "unofficial_whatsapp-entry-1";

function message(id: string, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id,
    entry_id: "entry-1",
    entry_type: "unofficial_whatsapp",
    channel: "unofficial_whatsapp",
    message_type: "operator",
    from: "",
    to: "",
    text: `texto ${id}`,
    sender_name: "",
    read: true,
    read_at: null,
    read_by: null,
    provider_message_id: `pm-${id}`,
    sender_user_id: "user-ana",
    created_at: new Date(Date.now() - 60_000).toISOString(),
    updated_at: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

function conversation(messages: ConversationMessage[]): ActiveConversation {
  return {
    entry_id: "entry-1",
    entry_type: "unofficial_whatsapp",
    lead_name: "Maria",
    lead_number: "5511",
    messages,
    has_more: false,
    unread_count: 0,
    window_open: true,
    window_expires_at: null,
    message_capabilities: { react: true, edit: true, delete: true, edit_window_seconds: 900, delete_window_seconds: 172800 },
  };
}

const onSend = vi.fn();

function composer() {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CrmMessageInput
        entryType="unofficial_whatsapp"
        entryId="entry-1"
        onSend={onSend}
        onSendMedia={vi.fn()}
        onTyping={vi.fn()}
        windowOpen
        windowExpiresAt={null}
        translations={inputT}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  mocks.crm.activeConversation = null;
  stopEditing(ENTRY_KEY);
});

afterEach(() => stopEditing(ENTRY_KEY));

describe("internal note mode", () => {
  it("switches to a note surface that saves through the notes action, never the message send", async () => {
    mocks.createNote.mockResolvedValue({
      note: {
        id: "n1",
        entry_id: "entry-1",
        entry_type: "unofficial_whatsapp",
        author_id: "user-ana",
        author_name: "Ana",
        body: "oi",
        mentions: ["user-bruno"],
        created_at: "2026-10-18T12:00:00Z",
      },
    });
    render(composer());
    fireEvent.click(screen.getByRole("radio", { name: copy.note }));
    const field = screen.getByRole("textbox", { name: copy.note });
    expect(field).toHaveAttribute("placeholder", copy.notePlaceholder);
    expect(screen.getByText(copy.noteHint)).toBeInTheDocument();

    fireEvent.change(field, { target: { value: "@br", selectionStart: 3 } });
    const list = screen.getByRole("listbox", { name: copy.mentions });
    fireEvent.mouseDown(screen.getByRole("option", { name: "Bruno Lima" }));
    expect(list).not.toBeInTheDocument();
    expect((field as HTMLTextAreaElement).value).toBe("@Bruno Lima ");

    fireEvent.change(field, { target: { value: "@Bruno Lima pode aprovar?" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() =>
      expect(mocks.createNote).toHaveBeenCalledWith("unofficial_whatsapp", "entry-1", "@Bruno Lima pode aprovar?", ["user-bruno"]),
    );
    expect(onSend).not.toHaveBeenCalled();
    await waitFor(() => expect((field as HTMLTextAreaElement).value).toBe(""));
  });

  it("keeps the note draft apart from the message draft", async () => {
    render(composer());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "mensagem para o cliente" } });
    fireEvent.click(screen.getByRole("radio", { name: copy.note }));
    expect(screen.getByRole("textbox", { name: copy.note })).toHaveValue("");
    fireEvent.click(screen.getByRole("radio", { name: copy.message }));
    expect(screen.getByRole("textbox")).toHaveValue("mensagem para o cliente");
  });
});

describe("editing the last message from the composer", () => {
  it("starts editing the operator's last editable message on ArrowUp in an empty composer", () => {
    mocks.crm.activeConversation = conversation([message("first"), message("last"), message("teammate", { sender_user_id: "user-bruno" })]);
    render(composer());
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowUp" });
    expect(editingMessageOf(ENTRY_KEY)).toBe("last");
  });

  it("leaves ArrowUp alone while there is text", () => {
    mocks.crm.activeConversation = conversation([message("last")]);
    render(composer());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "oi" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowUp" });
    expect(editingMessageOf(ENTRY_KEY)).toBeNull();
  });

  it("cancels the edit with Esc", () => {
    mocks.crm.activeConversation = conversation([message("last")]);
    render(composer());
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowUp" });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(editingMessageOf(ENTRY_KEY)).toBeNull();
  });
});
