import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ActiveConversation, ConversationMessage } from "@/lib/conversations/types";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));

const mocks = vi.hoisted(() => ({
  createNote: vi.fn(),
  uploadImage: vi.fn(),
  crm: { activeConversation: null as ActiveConversation | null, windowConversations: new Map(), runMessageAction: vi.fn(() => true) },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/actions/conversations", () => ({ uploadConversationMediaAction: vi.fn() }));
vi.mock("@/app/actions/message-shortcuts", () => ({ listMessageShortcutsAction: vi.fn().mockResolvedValue({ shortcuts: [] }) }));
vi.mock("@/app/actions/conversation-notes", () => ({
  createConversationNoteAction: mocks.createNote,
  listConversationNotesAction: vi.fn(),
  uploadNoteImageAction: mocks.uploadImage,
}));
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
      expect(mocks.createNote).toHaveBeenCalledWith("unofficial_whatsapp", "entry-1", "@Bruno Lima pode aprovar?", ["user-bruno"], []),
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

const notesT = ptMessages.crmMessage.notes;
const stripT = ptMessages.crmComposer.attachments;

function savedNote(overrides: Record<string, unknown> = {}) {
  return {
    note: {
      id: "n1",
      entry_id: "entry-1",
      entry_type: "unofficial_whatsapp",
      author_id: "user-ana",
      author_name: "Ana",
      body: "",
      mentions: [],
      images: [],
      created_at: "2026-10-18T12:00:00Z",
      ...overrides,
    },
  };
}

function png(name: string): File {
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });
}

function openNoteMode() {
  render(composer());
  fireEvent.click(screen.getByRole("radio", { name: copy.note }));
  return screen.getByRole("textbox", { name: copy.note });
}

function pickFiles(files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  expect(input).toHaveAttribute("accept", "image/*");
  fireEvent.change(input!, { target: { files } });
}

describe("images on an internal note", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("uploads picked images through the note upload, previews them and saves their ids with the note", async () => {
    mocks.uploadImage
      .mockResolvedValueOnce({ image: { id: "img-1", url: "https://cdn/1.png", mime_type: "image/png" } })
      .mockResolvedValueOnce({ image: { id: "img-2", url: "https://cdn/2.png", mime_type: "image/png" } });
    mocks.createNote.mockResolvedValue(savedNote());
    const field = openNoteMode();

    pickFiles([png("print-1.png"), png("print-2.png")]);

    await waitFor(() => expect(mocks.uploadImage).toHaveBeenCalledTimes(2));
    expect(mocks.uploadImage).toHaveBeenCalledWith("unofficial_whatsapp", "entry-1", expect.any(File));
    expect(await screen.findByText("print-1.png")).toBeInTheDocument();
    expect(screen.getByText("print-2.png")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: copy.saveNote })).toBeEnabled());

    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(mocks.createNote).toHaveBeenCalledWith("unofficial_whatsapp", "entry-1", "", [], ["img-1", "img-2"]));
    await waitFor(() => expect(screen.queryByText("print-1.png")).not.toBeInTheDocument());
  });

  it("drops a removed image before saving", async () => {
    mocks.uploadImage
      .mockResolvedValueOnce({ image: { id: "img-1", url: "https://cdn/1.png", mime_type: "image/png" } })
      .mockResolvedValueOnce({ image: { id: "img-2", url: "https://cdn/2.png", mime_type: "image/png" } });
    mocks.createNote.mockResolvedValue(savedNote({ body: "veja" }));
    const field = openNoteMode();

    pickFiles([png("fica.png"), png("sai.png")]);
    await screen.findByText("sai.png");
    await waitFor(() => expect(mocks.uploadImage).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: stripT.remove.replace("{name}", "sai.png") }));
    expect(screen.queryByText("sai.png")).not.toBeInTheDocument();

    fireEvent.change(field, { target: { value: "veja" } });
    fireEvent.click(screen.getByRole("button", { name: copy.saveNote }));

    await waitFor(() => expect(mocks.createNote).toHaveBeenCalledWith("unofficial_whatsapp", "entry-1", "veja", [], ["img-1"]));
  });

  it("shows the backend refusal on the image and keeps the note from saving until it is removed", async () => {
    mocks.uploadImage.mockResolvedValue({ image: null, error: "raw", code: "image_type" });
    const field = openNoteMode();
    fireEvent.change(field, { target: { value: "texto" } });

    pickFiles([png("planilha.png")]);

    expect(await screen.findByText(notesT.errors.image_type)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.saveNote })).toBeDisabled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(mocks.createNote).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: stripT.remove.replace("{name}", "planilha.png") }));
    expect(screen.getByRole("button", { name: copy.saveNote })).toBeEnabled();
  });

  it("waits for an upload in flight before it lets the note be saved", async () => {
    let finish: (value: unknown) => void = () => undefined;
    mocks.uploadImage.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const field = openNoteMode();
    fireEvent.change(field, { target: { value: "texto" } });

    pickFiles([png("lenta.png")]);
    await waitFor(() => expect(mocks.uploadImage).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: copy.saveNote })).toBeDisabled();

    await act(async () => finish({ image: { id: "img-9", url: "https://cdn/9.png", mime_type: "image/png" } }));
    expect(screen.getByRole("button", { name: copy.saveNote })).toBeEnabled();
  });

  it("attaches pasted images to the note, never to the message", async () => {
    mocks.uploadImage.mockResolvedValue({ image: { id: "img-1", url: "https://cdn/1.png", mime_type: "image/png" } });
    const field = openNoteMode();

    fireEvent.paste(field, { clipboardData: { files: [png("colada.png")], items: [] } });

    await waitFor(() => expect(mocks.uploadImage).toHaveBeenCalledWith("unofficial_whatsapp", "entry-1", expect.any(File)));
    expect(await screen.findByText("colada.png")).toBeInTheDocument();
  });

  it("translates a refused save from its code", async () => {
    const { toast } = await import("sonner");
    mocks.uploadImage.mockResolvedValue({ image: { id: "img-1", url: "https://cdn/1.png", mime_type: "image/png" } });
    mocks.createNote.mockResolvedValue({ note: null, error: "raw", code: "too_many_images" });
    const field = openNoteMode();
    pickFiles([png("a.png")]);
    await waitFor(() => expect(screen.getByRole("button", { name: copy.saveNote })).toBeEnabled());

    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(notesT.errors.too_many_images));
    expect(screen.getByText("a.png")).toBeInTheDocument();
  });
});

describe("note image copy", () => {
  it("translates every note image refusal the backend can answer, in every locale", async () => {
    const codes = ["too_many_images", "image_required", "image_type", "image_too_large", "image_not_found", "storage_unavailable"];
    for (const locale of ["pt", "en", "es", "de"]) {
      const messages = (await import(`@/i18n/messages/${locale}.json`)).default;
      for (const code of codes) expect(messages.crmMessage.notes.errors[code], `${locale} ${code}`).toBeTruthy();
      expect(messages.crmMessage.notes.images.open, locale).toBeTruthy();
      expect(messages.crmMessage.composer.addNoteImage, locale).toBeTruthy();
    }
  });
});
