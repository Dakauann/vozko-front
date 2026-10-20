import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { InboxEntry } from "@/lib/conversations/types";

import { CrmCommandCenter } from "../CrmCommandCenter";

const recent = [
  { entry_id: "a", entry_type: "whatsapp", lead_name: "Ana", lead_number: "1", last_message_preview: "oi", unread_count: 0 },
] as InboxEntry[];

function renderCenter(overrides: Partial<React.ComponentProps<typeof CrmCommandCenter>> = {}) {
  const props: React.ComponentProps<typeof CrmCommandCenter> = {
    enabled: true,
    recent,
    searchResults: null,
    searching: false,
    onSearch: vi.fn(),
    onEndSearch: vi.fn(),
    onOpenConversation: vi.fn(),
    commands: [],
    views: [
      { mode: "classic", label: "Chat" },
      { mode: "funnel", label: "Kanban" },
    ],
    currentView: "classic",
    onSwitchView: vi.fn(),
    ...overrides,
  };
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CrmCommandCenter {...props} />
    </NextIntlClientProvider>,
  );
  return props;
}

function openPalette() {
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the command palette", () => {
  it("opens on Ctrl+K with the recent conversations and the views", () => {
    renderCenter();
    openPalette();
    expect(screen.getByPlaceholderText(ptMessages.crmCommandPalette.placeholder)).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Kanban")).toBeInTheDocument();
  });

  it("opens a conversation from the list", async () => {
    const props = renderCenter();
    openPalette();
    fireEvent.click(screen.getByText("Ana"));
    await waitFor(() => expect(props.onOpenConversation).toHaveBeenCalledWith("a", "whatsapp"));
  });

  it("searches through the inbox search after a pause and hands the search back on close", () => {
    vi.useFakeTimers();
    const props = renderCenter();
    openPalette();
    fireEvent.change(screen.getByPlaceholderText(ptMessages.crmCommandPalette.placeholder), { target: { value: "maria" } });
    expect(props.onSearch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(props.onSearch).toHaveBeenCalledWith({ query: "maria", page: 1, page_size: 8 });
    fireEvent.keyDown(screen.getByPlaceholderText(ptMessages.crmCommandPalette.placeholder), { key: "Escape" });
    expect(props.onEndSearch).toHaveBeenCalledTimes(1);
  });

  it("lists only the actions it was given, with their shortcut, and runs them", async () => {
    const finish = vi.fn();
    renderCenter({ commands: [{ id: "conversation.finish", run: finish }] });
    openPalette();
    expect(screen.queryByText(ptMessages.crmShortcuts.bindings.conversationReply)).toBeNull();
    fireEvent.click(screen.getByText(ptMessages.crmShortcuts.bindings.conversationFinish));
    await waitFor(() => expect(finish).toHaveBeenCalled());
  });
});

describe("conversation shortcuts and the help", () => {
  it("runs a granted action from its key and ignores keys for actions it was not given", () => {
    const finish = vi.fn();
    renderCenter({ commands: [{ id: "conversation.finish", run: finish }] });
    fireEvent.keyDown(window, { key: "e" });
    fireEvent.keyDown(window, { key: "r" });
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("shows every binding of the catalog on ?", () => {
    renderCenter();
    fireEvent.keyDown(window, { key: "?", shiftKey: true });
    expect(screen.getByText(ptMessages.crmShortcuts.title)).toBeInTheDocument();
    expect(screen.getByText(ptMessages.crmShortcuts.bindings.inboxNext)).toBeInTheDocument();
    expect(screen.getByText(ptMessages.crmShortcuts.bindings.composerStrike)).toBeInTheDocument();
  });
});
