import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import ptMessages from "@/i18n/messages/pt.json";
import type { InboxEntry } from "@/lib/conversations/types";

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => false, currentWorkspace: null }),
}));
vi.mock("@/app/actions/workspace", () => ({ listAssignableMembersAction: vi.fn() }));
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

function entry(id: string, name: string, lastMessageAt: string, extra: Partial<InboxEntry> = {}): InboxEntry {
  return {
    entry_id: id,
    entry_type: "whatsapp",
    lead_name: name,
    lead_number: "5511999990000",
    last_message_at: lastMessageAt,
    last_message_preview: `mensagem de ${name}`,
    unread_count: 0,
    conversation_status: "ongoing",
    ...extra,
  } as InboxEntry;
}

const entries = [
  entry("a", "Ana", "2026-10-18T12:00:00Z"),
  entry("b", "Bruno", "2026-10-18T11:00:00Z"),
  entry("c", "Carla", "2026-10-18T10:00:00Z"),
];

function renderInbox(list: InboxEntry[], onSelect = vi.fn()) {
  const view = (next: InboxEntry[]) => (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CrmInbox entries={next} selectedEntryId={null} onSelect={onSelect} connectionStatus="connected" translations={ptMessages.liveChat.inbox} />
    </NextIntlClientProvider>
  );
  const utils = render(view(list));
  return { onSelect, rerender: (next: InboxEntry[]) => utils.rerender(view(next)) };
}

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-inbox-row]"));
}

function names(): string[] {
  return rows().map((row) => within(row).getAllByText(/Ana|Bruno|Carla|Davi/)[0].textContent ?? "");
}

describe("the inbox list from the keyboard", () => {
  it("offers a single tab stop for the whole list", () => {
    renderInbox(entries);
    expect(rows().map((row) => row.tabIndex)).toEqual([0, -1, -1]);
  });

  it("moves focus with j and k, and with the arrows", () => {
    renderInbox(entries);
    rows()[0].focus();
    fireEvent.keyDown(rows()[0], { key: "j" });
    expect(document.activeElement).toBe(rows()[1]);
    fireEvent.keyDown(rows()[1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows()[2]);
    fireEvent.keyDown(rows()[2], { key: "k" });
    expect(document.activeElement).toBe(rows()[1]);
    expect(rows()[1].tabIndex).toBe(0);
  });

  it("opens the focused conversation with Enter and says it came from the keyboard, so focus can stay on the list", () => {
    const { onSelect } = renderInbox(entries);
    rows()[1].focus();
    fireEvent.keyDown(rows()[1], { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("b", "whatsapp", "keyboard");
  });

  it("says a click opened the conversation", () => {
    const { onSelect } = renderInbox(entries);
    fireEvent.click(rows()[2]);
    expect(onSelect).toHaveBeenCalledWith("c", "whatsapp", "pointer");
  });
});

describe("the inbox order under the pointer", () => {
  it("holds rows in place while the pointer is over the list and applies the moves from the pill", () => {
    const { rerender } = renderInbox(entries);
    const list = rows()[0].closest("[data-shortcut-scope]") as HTMLElement;
    fireEvent.pointerEnter(list, { pointerType: "mouse" });
    rerender([entry("c", "Carla", "2026-10-18T12:30:00Z", { unread_count: 1 }), entries[0], entries[1]]);
    expect(names()).toEqual(["Ana", "Bruno", "Carla"]);
    fireEvent.click(screen.getByRole("button", { name: /1 atualização/ }));
    expect(names()).toEqual(["Carla", "Ana", "Bruno"]);
  });

  it("applies the held moves when the pointer leaves", () => {
    const { rerender } = renderInbox(entries);
    const list = rows()[0].closest("[data-shortcut-scope]") as HTMLElement;
    fireEvent.pointerEnter(list, { pointerType: "mouse" });
    rerender([entry("d", "Davi", "2026-10-18T12:40:00Z"), ...entries]);
    expect(names()).toEqual(["Ana", "Bruno", "Carla"]);
    fireEvent.pointerLeave(list);
    expect(names()).toEqual(["Davi", "Ana", "Bruno", "Carla"]);
  });
});

describe("search highlighting and empty states", () => {
  it("marks the search term in the row name", () => {
    renderInbox(entries);
    fireEvent.change(screen.getByPlaceholderText(ptMessages.liveChat.inbox.searchPlaceholder), { target: { value: "a" } });
    fireEvent.change(screen.getByPlaceholderText(ptMessages.liveChat.inbox.searchPlaceholder), { target: { value: "ar" } });
    expect(document.querySelector("mark")).toHaveTextContent("ar");
  });

  it("names the empty tab and offers the way back to the active conversations", () => {
    renderInbox([]);
    fireEvent.click(screen.getByRole("button", { name: /Finalizados/ }));
    expect(screen.getByText(ptMessages.liveChat.inbox.empty.finished)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ptMessages.liveChat.inbox.empty.showActive }));
    expect(screen.getByText(ptMessages.liveChat.inbox.noConversations)).toBeInTheDocument();
  });
});

describe("replying from the list", () => {
  it("moves to the open conversation's composer on r, without leaving the list for j and k first", () => {
    const onReplyToOpen = vi.fn();
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <CrmInbox
          entries={entries}
          selectedEntryId="a"
          onSelect={vi.fn()}
          onReplyToOpen={onReplyToOpen}
          connectionStatus="connected"
          translations={ptMessages.liveChat.inbox}
        />
      </NextIntlClientProvider>,
    );
    rows()[0].focus();
    fireEvent.keyDown(rows()[0], { key: "r" });
    expect(onReplyToOpen).toHaveBeenCalled();
  });
});
