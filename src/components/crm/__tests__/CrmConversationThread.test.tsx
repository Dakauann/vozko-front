import type { ActiveConversation, ConversationMessage } from "@/lib/conversations/types";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import { fullDateTime, messageTime } from "@/lib/conversations/thread-labels";
import CrmConversationView from "../CrmConversationView";

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const motionOnly = new Set(["initial", "animate", "exit", "transition", "whileHover", "whileTap"]);
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

vi.mock("@/app/actions/agents", () => ({
  getAgentToolsAction: vi.fn().mockResolvedValue({ tools: [], error: null }),
}));

vi.mock("@/app/actions/conversation-notes", () => ({
  listConversationNotesAction: vi.fn().mockResolvedValue({ notes: [], hasMore: false }),
}));

vi.mock("@/contexts/auth-context", () => ({ useSignedInUserId: () => "u1" }));

vi.mock("@/components/crm/ConversationAnalysisPanel", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/tooltip-wrapper", () => ({
  default: ({ children, content }: { children: React.ReactNode; content: string }) => (
    <span data-tooltip={content}>{children}</span>
  ),
}));

const thread = ptMessages.crmConversation.thread;
const LEAD = "+5511999999999";
const at = (minute: number, hour = 10) => new Date(Date.UTC(2025, 11, 1, hour, minute)).toISOString();

function Providers({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: Providers });

function msg(overrides: Partial<ConversationMessage> & { id: string }): ConversationMessage {
  return {
    entry_id: "entry-1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "user_message",
    from: LEAD,
    to: "+5511888888888",
    text: overrides.id,
    sender_name: "Lead User",
    read: true,
    read_at: null,
    read_by: null,
    created_at: at(0),
    updated_at: at(0),
    ...overrides,
  };
}

function conv(messages: ConversationMessage[], overrides: Partial<ActiveConversation> = {}): ActiveConversation {
  return {
    entry_id: "entry-1",
    entry_type: "whatsapp",
    lead_name: "Test Lead",
    lead_number: LEAD,
    has_more: false,
    unread_count: 0,
    window_open: true,
    window_expires_at: null,
    messages,
    ...overrides,
  };
}

const translations = {
  noConversationSelected: "No conversation selected",
  noConversationDescription: "Select a conversation",
  loadingMore: "Loading more...",
} as never;

type ViewProps = Partial<React.ComponentProps<typeof CrmConversationView>>;

function view(conversation: ActiveConversation, props: ViewProps = {}) {
  return <CrmConversationView conversation={conversation} isTyping={false} translations={translations} {...props} />;
}

function region() {
  return screen.getByRole("region", { name: thread.messagesRegion });
}

function scrollRegion(element: HTMLElement, metrics: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(element, key, { value, configurable: true, writable: true });
  }
  fireEvent.scroll(element);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("unread divider (T1)", () => {
  const page = [
    msg({ id: "seen", text: "already read", created_at: at(0) }),
    msg({ id: "new-1", text: "first unread", read: false, created_at: at(30) }),
    msg({ id: "new-2", text: "second unread", read: false, created_at: at(31) }),
  ];

  it("sits right before the first unread customer message", () => {
    render(view(conv(page)));
    const divider = screen.getByRole("separator", { name: thread.unreadDivider });
    expect(divider.compareDocumentPosition(screen.getByText("first unread")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(divider.compareDocumentPosition(screen.getByText("already read")) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("stays after mark_read flips the messages to read, until the operator leaves", () => {
    const { rerender } = render(view(conv(page)));
    rerender(view(conv(page.map((m) => ({ ...m, read: true })))));
    expect(screen.getByRole("separator", { name: thread.unreadDivider })).toBeInTheDocument();

    rerender(view(conv([msg({ id: "other", entry_id: "entry-2", text: "elsewhere" })], { entry_id: "entry-2" })));
    expect(screen.queryByRole("separator", { name: thread.unreadDivider })).toBeNull();
  });

  it("opens the thread at the divider instead of the bottom", () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(view(conv(page)));
    const divider = screen.getByRole("separator", { name: thread.unreadDivider });
    expect(scroll.mock.contexts).toContain(divider);
  });

  it("opens at the divider again when the operator closes and reopens the same conversation", () => {
    const { rerender } = render(view(conv(page)));
    rerender(<CrmConversationView conversation={null} isTyping={false} translations={translations} />);
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    rerender(view(conv(page)));
    expect(scroll.mock.contexts).toContain(screen.getByRole("separator", { name: thread.unreadDivider }));
  });

  it("is absent when everything was read on open", () => {
    render(view(conv([msg({ id: "seen", text: "already read" })])));
    expect(screen.queryByRole("separator", { name: thread.unreadDivider })).toBeNull();
  });
});

describe("jump to latest counter (T2)", () => {
  it("counts what arrived while the operator was scrolled up and resets at the bottom", () => {
    const first = msg({ id: "a", created_at: at(0) });
    const { rerender } = render(view(conv([first])));
    const scroller = region();
    scrollRegion(scroller, { scrollTop: 100, scrollHeight: 2000, clientHeight: 500 });
    expect(screen.getByLabelText(thread.scrollToLatest)).toBeInTheDocument();

    const second = msg({ id: "b", created_at: at(1) });
    rerender(view(conv([first, second])));
    expect(screen.getByLabelText("1 nova mensagem abaixo")).toBeInTheDocument();

    rerender(view(conv([first, second, msg({ id: "c", created_at: at(2) })])));
    expect(screen.getByLabelText("2 novas mensagens abaixo")).toBeInTheDocument();

    scrollRegion(scroller, { scrollTop: 1500, scrollHeight: 2000, clientHeight: 500 });
    expect(screen.queryByLabelText(/abaixo/)).toBeNull();
    scrollRegion(scroller, { scrollTop: 100, scrollHeight: 2000, clientHeight: 500 });
    expect(screen.getByLabelText(thread.scrollToLatest)).toBeInTheDocument();
  });
});

describe("sticky day header (T3)", () => {
  it("keeps each day's header inside that day's section so it only sticks over its own day", () => {
    render(view(conv([msg({ id: "d1", created_at: at(0, 10) }), msg({ id: "d2", created_at: new Date(Date.UTC(2025, 11, 2, 10)).toISOString() })])));
    const headers = document.querySelectorAll("[data-day-header]");
    expect(headers).toHaveLength(2);
    for (const header of headers) {
      expect(header.className).toContain("sticky");
      expect(header.parentElement?.tagName).toBe("SECTION");
    }
    expect(headers[0].parentElement).not.toBe(headers[1].parentElement);
  });
});

describe("grouping (T4)", () => {
  it("groups one sender's messages within five minutes and shapes the joined corners", () => {
    render(
      view(
        conv([
          msg({ id: "g1", text: "one", created_at: at(0) }),
          msg({ id: "g2", text: "two", created_at: at(2) }),
          msg({ id: "g3", text: "three", created_at: at(4) }),
          msg({ id: "g4", text: "later", created_at: at(20) }),
        ]),
      ),
    );
    const positions = [...document.querySelectorAll("[data-group-position]")].map((el) => el.getAttribute("data-group-position"));
    expect(positions).toEqual(["first", "middle", "last", "single"]);

    const bubble = (id: string) => document.querySelector(`[data-msg-id="${id}"] [data-bubble]`)!.className;
    expect(bubble("g1")).toContain("rounded-bl-sm");
    expect(bubble("g1")).not.toContain("rounded-tl-sm");
    expect(bubble("g2")).toContain("rounded-tl-sm");
    expect(bubble("g2")).toContain("rounded-bl-sm");
    expect(bubble("g3")).toContain("rounded-tl-sm");
    expect(bubble("g3")).not.toContain("rounded-bl-sm");
    expect(bubble("g4")).not.toMatch(/rounded-(tl|bl)-sm/);
    expect(screen.getAllByText("Lead User")).toHaveLength(2);
  });
});

describe("quote of a message that is not loaded (T7)", () => {
  it("asks for the page around the original by its id in one request, then jumps to it with the flash", async () => {
    const onLoadMore = vi.fn();
    const onLoadAround = vi.fn();
    const reply = msg({ id: "reply", text: "answering", reply_to_message_id: "old", message_type: "operator", created_at: at(30) });
    const { rerender } = render(view(conv([reply], { has_more: true }), { onLoadMore, onLoadAround }));

    fireEvent.click(screen.getByText(thread.originalNotLoaded));
    await waitFor(() => expect(onLoadAround).toHaveBeenCalledWith({ messageId: "old" }));
    expect(onLoadAround).toHaveBeenCalledTimes(1);
    expect(onLoadMore).not.toHaveBeenCalled();

    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const original = msg({ id: "old", text: "the original", created_at: at(0) });
    rerender(view(conv([original, reply], { has_more: false, has_after: true }), { onLoadMore, onLoadAround }));

    await waitFor(() => {
      const target = document.querySelector('[data-msg-id="old"]');
      expect(scroll.mock.contexts).toContain(target);
      expect(target?.className).toContain("ring-info");
    });
  });

  it("says the original is unavailable when there is nothing older to load", () => {
    render(view(conv([msg({ id: "reply", reply_to_message_id: "gone" })]), { onLoadAround: vi.fn() }));
    expect(screen.getByText(thread.originalUnavailable)).toBeInTheDocument();
    expect(screen.queryByText(thread.originalNotLoaded)).toBeNull();
  });
});

describe("after a jump (F6)", () => {
  const jumped = [msg({ id: "j1", created_at: at(0) }), msg({ id: "j2", created_at: at(1) })];

  it("loads the newer page when the operator scrolls to the bottom of a jumped thread", () => {
    const onLoadNewer = vi.fn();
    render(view(conv(jumped, { has_after: true }), { onLoadNewer }));

    scrollRegion(region(), { scrollTop: 400, scrollHeight: 1000, clientHeight: 580 });

    expect(onLoadNewer).toHaveBeenCalledTimes(1);
  });

  it("does not page forward a thread that is already at the present", () => {
    const onLoadNewer = vi.fn();
    render(view(conv(jumped), { onLoadNewer }));
    scrollRegion(region(), { scrollTop: 400, scrollHeight: 1000, clientHeight: 580 });
    expect(onLoadNewer).not.toHaveBeenCalled();
  });

  it("goes back to the present from jump to latest instead of only scrolling", () => {
    const onReturnToPresent = vi.fn();
    render(view(conv(jumped, { has_after: true }), { onReturnToPresent }));

    fireEvent.click(screen.getByRole("button", { name: thread.scrollToLatest }));

    expect(onReturnToPresent).toHaveBeenCalledTimes(1);
  });
});

describe("pending and failed sends (T9)", () => {
  const sent = [msg({ id: "in", created_at: at(0) })];
  const queued = (state: "pending" | "failed", failure?: string) => ({
    requestId: "r1",
    entryId: "entry-1",
    entryType: "whatsapp" as const,
    payload: { kind: "text" as const, text: "on its way", signed: true },
    state,
    ...(failure ? { failure } : {}),
    queuedAt: at(5),
  });

  it("shows a send as an outgoing bubble marked as sending until the server confirms it", () => {
    render(view(conv(sent), { outbox: [queued("pending")] }));
    const bubble = document.querySelector('[data-msg-id="pending:r1"]');
    expect(bubble?.textContent).toContain("on its way");
    expect(screen.getByLabelText(thread.sendPending)).toBeInTheDocument();
  });

  it("drops the pending bubble once the real message with its request id is in the thread", () => {
    const delivered = msg({ id: "m1", text: "on its way", message_type: "operator", client_request_id: "r1", created_at: at(5) });
    render(view(conv([...sent, delivered]), { outbox: [queued("pending")] }));
    expect(document.querySelector('[data-msg-id="pending:r1"]')).toBeNull();
    expect(document.querySelector('[data-msg-id="m1"]')).not.toBeNull();
  });

  it("explains a refused send and retries it with the same request id", () => {
    const onRetrySend = vi.fn();
    render(view(conv(sent), { outbox: [queued("failed", "send_failed")], onRetrySend }));

    expect(screen.getByText(ptMessages.crmConversation.sendError.sendFailed)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: thread.retrySend }));

    expect(onRetrySend).toHaveBeenCalledWith("r1");
  });

  it("offers a resend for a stored message whose delivery failed", () => {
    const onResendMessage = vi.fn();
    const failed = msg({ id: "f1", message_type: "operator", sender_user_id: "u1", delivery_status: "failed", created_at: at(3) });
    render(view(conv([...sent, failed]), { onResendMessage }));

    fireEvent.click(screen.getByRole("button", { name: thread.retrySend }));

    expect(onResendMessage).toHaveBeenCalledWith("f1");
  });

  it("folds a failed message away once the message that replaced it is in the thread", () => {
    const failed = msg({ id: "f1", message_type: "operator", sender_user_id: "u1", delivery_status: "failed", resent_as: "f2", created_at: at(3) });
    const replacement = msg({ id: "f2", message_type: "operator", created_at: at(4) });
    render(view(conv([...sent, failed, replacement]), { onResendMessage: vi.fn() }));

    expect(document.querySelector('[data-msg-id="f1"]')).toBeNull();
    expect(screen.queryByRole("button", { name: thread.retrySend })).toBeNull();
  });
});

describe("timestamps (T8)", () => {
  it("shows the full date and time on hover", () => {
    const sentAt = at(5);
    render(view(conv([msg({ id: "t1", created_at: sentAt })])));
    const time = screen.getByText(messageTime(sentAt, "pt")!);
    expect(time.closest("[data-tooltip]")?.getAttribute("data-tooltip")).toBe(fullDateTime(sentAt, "pt"));
  });

  it("adds when the customer read an outgoing message", () => {
    const sentAt = at(5);
    const readAt = at(9);
    render(view(conv([msg({ id: "t2", message_type: "operator", created_at: sentAt, read_at: readAt })])));
    const tooltip = screen.getByText(messageTime(sentAt, "pt")!).closest("[data-tooltip]")?.getAttribute("data-tooltip");
    expect(tooltip).toBe(`${fullDateTime(sentAt, "pt")} · Lido às ${messageTime(readAt, "pt")}`);
  });
});

describe("media gallery (T10)", () => {
  it("walks through the conversation's photos with the arrow keys and gives focus back on close", async () => {
    render(
      view(
        conv([
          msg({ id: "p1", text: "first photo", media_type: "image", media_url: "https://cdn/1.jpg", created_at: at(0) }),
          msg({ id: "p2", text: "second photo", media_type: "image", media_url: "https://cdn/2.jpg", created_at: at(1) }),
        ]),
      ),
    );
    const opener = screen.getByRole("button", { name: "first photo" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("1 de 2");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(dialog).toHaveTextContent("2 de 2");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(dialog).toHaveTextContent("2 de 2");
    expect(screen.getByRole("link", { name: thread.gallery.download })).toHaveAttribute("href", "https://cdn/2.jpg");

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

describe("live announcements (T11)", () => {
  it("announces a new customer message with the sender and a short preview", async () => {
    const first = msg({ id: "a", created_at: at(0) });
    const { rerender } = render(view(conv([first])));
    rerender(view(conv([first, msg({ id: "b", text: "chegou agora", created_at: at(1) })])));
    const announcer = document.querySelector("[data-thread-announcer]");
    expect(announcer).toHaveAttribute("aria-live", "polite");
    await waitFor(() => expect(announcer?.textContent).toBe("Lead User: chegou agora"));
  });

  it("stays quiet for our own outgoing messages", async () => {
    const first = msg({ id: "a", created_at: at(0) });
    const { rerender } = render(view(conv([first])));
    rerender(view(conv([first, msg({ id: "b", message_type: "operator", text: "nossa resposta", created_at: at(1) })])));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.querySelector("[data-thread-announcer]")?.textContent).toBe("");
  });
});

describe("thread search shortcut (T13)", () => {
  it("opens the thread search on Ctrl+F instead of the browser's find", () => {
    render(view(conv([msg({ id: "a" })]), { onSearchMessages: vi.fn(), onClearMessageSearch: vi.fn() }));
    const notPrevented = fireEvent.keyDown(region(), { key: "f", ctrlKey: true });
    expect(notPrevented).toBe(false);
    expect(screen.getByPlaceholderText(ptMessages.crm.searchMessagesPlaceholder)).toBeInTheDocument();
  });

  it("leaves Ctrl+F to the browser when the thread has no search", () => {
    render(view(conv([msg({ id: "a" })])));
    expect(fireEvent.keyDown(region(), { key: "f", ctrlKey: true })).toBe(true);
  });
});

describe("conversation switch (T14)", () => {
  it("keeps the previous thread, untouchable, until the next one's first page arrives", () => {
    const { rerender } = render(view(conv([msg({ id: "a", text: "from the first chat" })])));
    const next = conv([], { entry_id: "entry-2" });
    rerender(view(next, { loadingConversation: true }));

    expect(screen.getByText("from the first chat")).toBeInTheDocument();
    expect(region()).toHaveAttribute("inert");
    expect(screen.getByRole("status")).toBeInTheDocument();

    rerender(view(conv([msg({ id: "b", entry_id: "entry-2", text: "from the second chat" })], { entry_id: "entry-2" })));
    expect(screen.getByText("from the second chat")).toBeInTheDocument();
    expect(screen.queryByText("from the first chat")).toBeNull();
    expect(region()).not.toHaveAttribute("inert");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
