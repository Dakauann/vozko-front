import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { GroupDetail, GroupFeedMessage, GroupMessagesPage } from "@/lib/unofficial-whatsapp-groups/types";

import { MessagesTab } from "./messages-tab";
import type { GroupPermissions } from "./use-group-permissions";

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
}));

const getGroupMessagesAction = vi.fn();

vi.mock("@/app/actions/unofficial-whatsapp-groups", () => ({
  getGroupMessagesAction: (...args: unknown[]) => getGroupMessagesAction(...args),
}));

const copy = ptMessages.unofficialGroups.detail.messagesTab;

function Providers({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo" now={new Date("2026-10-18T15:00:00Z")}>
      {children}
    </NextIntlClientProvider>
  );
}

function permissions(openConversation: boolean): GroupPermissions {
  return {
    update: false,
    create: false,
    leave: false,
    removeMembers: false,
    configure: false,
    exportMembers: false,
    addLeads: false,
    createCampaign: false,
    openConversation,
    uploadMedia: false,
  };
}

function detail(conversationId: string | null): GroupDetail {
  return {
    group: { id: "g-1", subject: "Vendas" },
    conversationId: conversationId ?? undefined,
    activity: { messages: 12, lastActivity: "2026-10-18T14:00:00Z" },
  } as unknown as GroupDetail;
}

function message(id: string, minute: number, overrides: Partial<GroupFeedMessage> = {}): GroupFeedMessage {
  return {
    id,
    entryId: "conv-1",
    channel: "unofficial_whatsapp",
    messageType: "user_message",
    direction: "INBOUND",
    from: "+5511970001234",
    senderName: "Ana do grupo",
    ourTeam: false,
    text: `mensagem ${id}`,
    read: false,
    createdAt: new Date(Date.UTC(2026, 9, 18, 12, minute)).toISOString(),
    ...overrides,
  };
}

function page(messages: GroupFeedMessage[], nextBefore?: string): { data: GroupMessagesPage } {
  return { data: { conversationId: "conv-1", messages, hasMore: Boolean(nextBefore), nextBefore } };
}

function renderTab(conversationId: string | null = "conv-1", openConversation = true) {
  return rtlRender(<MessagesTab detail={detail(conversationId)} permissions={permissions(openConversation)} />, { wrapper: Providers });
}

beforeEach(() => {
  getGroupMessagesAction.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("MessagesTab", () => {
  it("reads the group messages in place, without a send box", async () => {
    getGroupMessagesAction.mockResolvedValue(
      page([
        message("m1", 1),
        message("m2", 2, { direction: "OUTBOUND", ourTeam: true, senderName: "Nossa equipe", from: "", messageType: "operator" }),
      ]),
    );
    renderTab();

    expect(await screen.findByText("mensagem m1")).toBeTruthy();
    expect(screen.getByText("mensagem m2")).toBeTruthy();
    expect(screen.getByText("Ana do grupo")).toBeTruthy();
    expect(getGroupMessagesAction).toHaveBeenCalledWith("g-1");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("link", { name: copy.open })).toBeTruthy();
    expect(screen.getByText(copy.historyStart)).toBeTruthy();
  });

  it("keeps the feed for people without conversation access, with no way to open the inbox", async () => {
    getGroupMessagesAction.mockResolvedValue(page([message("m1", 1)]));
    renderTab("conv-1", false);

    expect(await screen.findByText("mensagem m1")).toBeTruthy();
    expect(screen.queryByRole("link", { name: copy.open })).toBeNull();
  });

  it("shows the empty state when the group has no messages", async () => {
    getGroupMessagesAction.mockResolvedValue(page([]));
    renderTab();

    expect(await screen.findByText(copy.empty)).toBeTruthy();
    expect(screen.queryByText(copy.historyStart)).toBeNull();
  });

  it("shows the error with a retry that loads the messages", async () => {
    getGroupMessagesAction.mockResolvedValueOnce({ error: "boom", status: 500 }).mockResolvedValueOnce(page([message("m1", 1)]));
    renderTab();

    expect(await screen.findByText(copy.error)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: copy.retry }));
    expect(await screen.findByText("mensagem m1")).toBeTruthy();
    expect(getGroupMessagesAction).toHaveBeenCalledTimes(2);
  });

  it("loads older messages with the cursor when scrolled to the top", async () => {
    const cursor = new Date(Date.UTC(2026, 9, 18, 12, 10)).toISOString();
    getGroupMessagesAction
      .mockResolvedValueOnce(page([message("m10", 10), message("m11", 11)], cursor))
      .mockResolvedValueOnce(page([message("m5", 5)]));
    renderTab();

    expect(await screen.findByText("mensagem m10")).toBeTruthy();
    expect(screen.queryByText(copy.historyStart)).toBeNull();
    const region = screen.getByRole("region", { name: copy.feedRegion });
    region.scrollTop = 0;
    fireEvent.scroll(region);

    expect(await screen.findByText("mensagem m5")).toBeTruthy();
    expect(getGroupMessagesAction).toHaveBeenLastCalledWith("g-1", cursor);
    expect(screen.getByText(copy.historyStart)).toBeTruthy();
  });

  it("refreshes from the latest page", async () => {
    getGroupMessagesAction.mockResolvedValueOnce(page([message("m1", 1)])).mockResolvedValueOnce(page([message("m1", 1), message("m2", 2)]));
    renderTab();

    expect(await screen.findByText("mensagem m1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: copy.refresh }));
    expect(await screen.findByText("mensagem m2")).toBeTruthy();
    expect(getGroupMessagesAction).toHaveBeenNthCalledWith(2, "g-1");
  });

  it("explains when the group has no conversation yet", async () => {
    renderTab(null);

    expect(screen.getByText(copy.noConversation)).toBeTruthy();
    await waitFor(() => expect(getGroupMessagesAction).not.toHaveBeenCalled());
  });
});
