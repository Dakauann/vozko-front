import type { ActiveConversation, ConversationMessage } from "@/lib/conversations/types";
import type { ConversationNote } from "@/lib/conversations/notes";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";

const { crm, notesApi } = vi.hoisted(() => ({
  crm: {
    runMessageAction: vi.fn(() => true),
    subscribeServerEvents: vi.fn(() => () => {}),
    viewersByEntry: new Map(),
    typingByEntry: new Map(),
  },
  notesApi: {
    listConversationNotesAction: vi.fn(),
    createConversationNoteAction: vi.fn(),
    deleteConversationNoteAction: vi.fn(),
  },
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const motionOnly = new Set(["initial", "animate", "exit", "transition", "whileHover", "whileTap", "layout"]);
  const cache = new Map<string, unknown>();
  const element = (prop: string) => {
    const Element = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) =>
      React.createElement(prop, { ...Object.fromEntries(Object.entries(props).filter(([key]) => !motionOnly.has(key))), ref }),
    );
    Element.displayName = `motion.${prop}`;
    return Element;
  };
  return {
    motion: new Proxy(
      {},
      {
        get: (_target: unknown, prop: string) => {
          if (!cache.has(prop)) cache.set(prop, element(prop));
          return cache.get(prop);
        },
      },
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => false,
  };
});

vi.mock("@/app/actions/conversations", () => ({
  getConversationMediaAction: vi.fn().mockResolvedValue({ url: "" }),
  listConversationToolCallsAction: vi.fn().mockResolvedValue({ page: { calls: [], page: 1, totalPages: 1 } }),
}));
vi.mock("@/app/actions/agents", () => ({ getAgentToolsAction: vi.fn().mockResolvedValue({ tools: [], error: null }) }));
vi.mock("@/app/actions/conversation-notes", () => notesApi);
vi.mock("@/components/crm/ConversationAnalysisPanel", () => ({ default: () => null }));
vi.mock("@/components/ui/tooltip-wrapper", () => ({
  default: ({ children, content }: { children: React.ReactNode; content: string }) => <span data-tooltip={content}>{children}</span>,
}));
vi.mock("@/contexts/crm-context", () => ({ useOptionalCrm: () => crm }));
vi.mock("@/contexts/auth-context", () => ({ useSignedInUserId: () => "user-ana" }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }) }));
vi.mock("@/hooks/use-assignable-members", () => ({
  memberDisplayName: (member: { username?: string; userId: string }) => member.username ?? member.userId,
  useAssignableMembers: () => ({ members: [], names: new Map([["user-bruno", "Bruno"]]) }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import CrmConversationView from "../CrmConversationView";
import { stopEditing } from "@/hooks/use-message-editing";

const copy = ptMessages.crmMessage;
const capabilities = { react: true, edit: true, delete: true, edit_window_seconds: 900, delete_window_seconds: 172800 };

function Providers({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: Providers });

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function msg(overrides: Partial<ConversationMessage> & { id: string }): ConversationMessage {
  return {
    entry_id: "entry-1",
    entry_type: "unofficial_whatsapp",
    channel: "unofficial_whatsapp",
    message_type: "user_message",
    from: "5511",
    to: "me",
    text: `texto ${overrides.id}`,
    sender_name: "Maria",
    read: true,
    read_at: null,
    read_by: null,
    provider_message_id: `pm-${overrides.id}`,
    created_at: minutesAgo(5),
    updated_at: minutesAgo(5),
    ...overrides,
  };
}

function mine(id: string, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return msg({
    id,
    message_type: "operator",
    direction: "OUTBOUND",
    sent_by: { kind: "human", id: "user-ana" },
    sender_user_id: "user-ana",
    ...overrides,
  });
}

function conv(messages: ConversationMessage[], overrides: Partial<ActiveConversation> = {}): ActiveConversation {
  return {
    entry_id: "entry-1",
    entry_type: "unofficial_whatsapp",
    lead_name: "Maria",
    lead_number: "5511",
    has_more: false,
    unread_count: 0,
    window_open: true,
    window_expires_at: null,
    messages,
    message_capabilities: capabilities,
    ...overrides,
  };
}

const translations = { noConversationSelected: "x", noConversationDescription: "y", loadingMore: "z" } as never;

function view(conversation: ActiveConversation, props: Partial<React.ComponentProps<typeof CrmConversationView>> = {}) {
  return <CrmConversationView conversation={conversation} isTyping={false} translations={translations} onReply={vi.fn()} {...props} />;
}

function bubbleOf(id: string): HTMLElement {
  const row = document.querySelector(`[data-msg-id="${id}"]`) as HTMLElement;
  return row.querySelector("[data-bubble]") as HTMLElement;
}

async function openMenuWithRightClick(id: string) {
  fireEvent.contextMenu(bubbleOf(id), { clientX: 10, clientY: 10 });
  return screen.findByRole("menu");
}

describe("message actions in the thread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    crm.runMessageAction.mockReturnValue(true);
    notesApi.listConversationNotesAction.mockResolvedValue({ notes: [], hasMore: false });
    stopEditing("unofficial_whatsapp-entry-1");
  });

  afterEach(() => stopEditing("unofficial_whatsapp-entry-1"));

  it("offers on a customer message only what the rule allows: reacting, replying and copying", async () => {
    render(view(conv([msg({ id: "in-1" })])));
    const menu = await openMenuWithRightClick("in-1");
    expect(within(menu).getByRole("menuitem", { name: copy.actions.reactWith.replace("{emoji}", "👍") })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: copy.actions.reply })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: copy.actions.copy })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: copy.actions.edit })).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: copy.actions.delete })).toBeNull();
  });

  it("reacts with a quick emoji through the socket command", async () => {
    render(view(conv([msg({ id: "in-1" })])));
    const menu = await openMenuWithRightClick("in-1");
    fireEvent.click(within(menu).getByRole("menuitem", { name: copy.actions.reactWith.replace("{emoji}", "❤️") }));
    expect(crm.runMessageAction).toHaveBeenCalledWith({
      kind: "react",
      entryId: "entry-1",
      entryType: "unofficial_whatsapp",
      messageId: "in-1",
      emoji: "❤️",
    });
  });

  it("opens the menu from the keyboard with Enter or Shift+F10 on a focused bubble", async () => {
    render(view(conv([msg({ id: "in-1" })])));
    const bubble = bubbleOf("in-1");
    expect(bubble).toHaveAttribute("tabindex", "0");
    act(() => bubble.focus());
    fireEvent.keyDown(bubble, { key: "Enter" });
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    fireEvent.keyDown(bubble, { key: "F10", shiftKey: true });
    expect(await screen.findByRole("menu")).toBeInTheDocument();
  });

  it("edits the operator's own text inline: Enter saves through the socket", async () => {
    render(view(conv([mine("out-1", { text: "Oi Maria" })])));
    const menu = await openMenuWithRightClick("out-1");
    fireEvent.click(within(menu).getByRole("menuitem", { name: copy.actions.edit }));
    const editor = await screen.findByRole("textbox", { name: copy.edit.label });
    fireEvent.change(editor, { target: { value: "Oi, Maria!" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(crm.runMessageAction).toHaveBeenCalledWith({
      kind: "edit",
      entryId: "entry-1",
      entryType: "unofficial_whatsapp",
      messageId: "out-1",
      text: "Oi, Maria!",
    });
    await waitFor(() => expect(screen.queryByRole("textbox", { name: copy.edit.label })).toBeNull());
  });

  it("cancels an inline edit with Esc and sends nothing", async () => {
    render(view(conv([mine("out-1")])));
    const menu = await openMenuWithRightClick("out-1");
    fireEvent.click(within(menu).getByRole("menuitem", { name: copy.actions.edit }));
    const editor = await screen.findByRole("textbox", { name: copy.edit.label });
    fireEvent.keyDown(editor, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("textbox", { name: copy.edit.label })).toBeNull());
    expect(crm.runMessageAction).not.toHaveBeenCalled();
  });

  it("asks before deleting for everyone", async () => {
    render(view(conv([mine("out-1")])));
    const menu = await openMenuWithRightClick("out-1");
    fireEvent.click(within(menu).getByRole("menuitem", { name: copy.actions.delete }));
    const dialog = await screen.findByRole("alertdialog");
    expect(crm.runMessageAction).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: copy.delete.confirm }));
    await waitFor(() =>
      expect(crm.runMessageAction).toHaveBeenCalledWith({
        kind: "delete",
        entryId: "entry-1",
        entryType: "unofficial_whatsapp",
        messageId: "out-1",
      }),
    );
  });

  it("never lets a teammate's message be edited or deleted", async () => {
    render(view(conv([mine("out-2", { sent_by: { kind: "human", id: "user-bruno" }, sender_user_id: "user-bruno" })])));
    const menu = await openMenuWithRightClick("out-2");
    expect(within(menu).queryByRole("menuitem", { name: copy.actions.edit })).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: copy.actions.delete })).toBeNull();
  });

  it("offers no retry on a failed template, because a resend would go out as free text", () => {
    render(view(conv([mine("tpl-1", { message_type: "template", delivery_status: "failed" })]), { onResendMessage: vi.fn() }));
    expect(screen.queryByRole("button", { name: ptMessages.crmConversation.thread.retrySend })).toBeNull();
  });

  it("still offers a retry on a failed text the operator can resend", () => {
    render(view(conv([mine("txt-1", { delivery_status: "failed" })]), { onResendMessage: vi.fn() }));
    expect(screen.getByRole("button", { name: ptMessages.crmConversation.thread.retrySend })).toBeInTheDocument();
  });
});

describe("message states in the thread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notesApi.listConversationNotesAction.mockResolvedValue({ notes: [], hasMore: false });
  });

  it("shows reactions as chips grouped by emoji, naming who reacted", () => {
    const reactions = [
      { emoji: "👍", direction: "inbound" as const, at: minutesAgo(1) },
      { emoji: "👍", direction: "outbound" as const, actor_id: "user-ana", at: minutesAgo(1) },
      { emoji: "❤️", direction: "outbound" as const, actor_id: "user-bruno", at: minutesAgo(1) },
    ];
    render(view(conv([msg({ id: "in-1", reactions })])));
    const group = screen.getByRole("group", { name: copy.reactions.group });
    expect(within(group).getByRole("button", { name: "👍: Maria e Você" })).toHaveTextContent("👍2");
    expect(within(group).getByRole("button", { name: "❤️: Bruno" })).toBeInTheDocument();
  });

  it("pins reactions on the bubble's outer edge, the right of an inbound message and the left of an outbound one", () => {
    const reactions = [{ emoji: "👍", direction: "inbound" as const, at: minutesAgo(1) }];
    render(view(conv([msg({ id: "in-1", reactions }), mine("out-1", { reactions })])));
    const [inbound, outbound] = screen.getAllByRole("group", { name: copy.reactions.group });
    expect(inbound).toHaveAttribute("data-edge", "end");
    expect(outbound).toHaveAttribute("data-edge", "start");
    for (const group of [inbound, outbound]) {
      expect(group.className).toContain("absolute");
      expect(group.closest("[data-msg-id]")?.className).toContain("mb-3");
    }
  });

  it("leaves no reaction space under a message nobody reacted to", () => {
    render(view(conv([msg({ id: "in-1" })])));
    expect(document.querySelector('[data-msg-id="in-1"]')?.className).not.toContain("mb-3");
  });

  it("shows reactions on a channel without reacting as plain chips", () => {
    const reactions = [{ emoji: "😂", direction: "inbound" as const, at: minutesAgo(1) }];
    render(view(conv([msg({ id: "in-1", reactions })], { message_capabilities: undefined })));
    expect(screen.getByRole("img", { name: "😂: Maria" })).toBeInTheDocument();
  });

  it("replaces a deleted message with a notice and no content", () => {
    render(view(conv([msg({ id: "in-1", text: "", retracted_at: minutesAgo(1) }), mine("out-1", { text: "", retracted_at: minutesAgo(1) })])));
    expect(screen.getByText(copy.states.retractedByContact)).toBeInTheDocument();
    expect(screen.getByText(copy.states.retracted)).toBeInTheDocument();
  });

  it("marks an edited message, with the time in the tooltip", () => {
    render(view(conv([mine("out-1", { edited_at: "2026-10-18T12:30:00Z" })])));
    const mark = screen.getByText(copy.states.edited);
    expect(mark.closest("[data-tooltip]")?.getAttribute("data-tooltip")).toMatch(/^Editada em /);
  });

  it("keeps an audio transcript collapsed until asked, as selectable text", () => {
    render(view(conv([msg({ id: "audio-1", message_type: "audio", text: "[Áudio]", transcript: "Quero o plano anual" })])));
    expect(screen.queryByText("Quero o plano anual")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: copy.transcript.show }));
    expect(screen.getByText("Quero o plano anual")).toHaveClass("select-text");
  });

  it("names the teammate typing", () => {
    crm.viewersByEntry = new Map([["unofficial_whatsapp-entry-1", [{ user_id: "user-bruno", name: "Bruno" }]]]);
    crm.typingByEntry = new Map([["unofficial_whatsapp-entry-1", new Set(["user-bruno"])]]);
    render(view(conv([msg({ id: "in-1" })]), { isTyping: true }));
    expect(screen.getByText("Bruno está digitando")).toBeInTheDocument();
    crm.viewersByEntry = new Map();
    crm.typingByEntry = new Map();
  });
});

describe("internal notes in the thread", () => {
  const note: ConversationNote = {
    id: "n1",
    entry_id: "entry-1",
    entry_type: "unofficial_whatsapp",
    author_id: "user-ana",
    author_name: "Ana",
    body: "Cliente pediu desconto",
    mentions: [],
    created_at: minutesAgo(3),
  };

  beforeEach(() => vi.clearAllMocks());

  it("interleaves notes by time as their own row, and lets the author delete one", async () => {
    notesApi.listConversationNotesAction.mockResolvedValue({ notes: [note], hasMore: false });
    notesApi.deleteConversationNoteAction.mockResolvedValue({});
    render(view(conv([msg({ id: "early", created_at: minutesAgo(5) }), msg({ id: "late", created_at: minutesAgo(1) })])));
    const row = await screen.findByRole("article", { name: copy.notes.label });
    expect(row).toHaveTextContent("Cliente pediu desconto");
    expect(row).toHaveTextContent("Ana");
    const ids = [...document.querySelectorAll("[data-msg-id], [data-note-id]")].map(
      (element) => element.getAttribute("data-msg-id") ?? element.getAttribute("data-note-id"),
    );
    expect(ids).toEqual(["early", "n1", "late"]);

    fireEvent.click(within(row).getByRole("button", { name: copy.notes.delete }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: copy.notes.delete }));
    await waitFor(() => expect(notesApi.deleteConversationNoteAction).toHaveBeenCalledWith("n1"));
    await waitFor(() => expect(screen.queryByRole("article", { name: copy.notes.label })).toBeNull());
  });

  it("does not offer deleting a teammate's note", async () => {
    notesApi.listConversationNotesAction.mockResolvedValue({ notes: [{ ...note, id: "n2", author_id: "user-bruno", author_name: "Bruno" }], hasMore: false });
    render(view(conv([msg({ id: "early", created_at: minutesAgo(5) })], { entry_id: "entry-2" })));
    const row = await screen.findByRole("article", { name: copy.notes.label });
    expect(within(row).queryByRole("button", { name: copy.notes.delete })).toBeNull();
  });
});
