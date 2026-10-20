import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { isMarkedUnread, isPinned } from "@/lib/conversations/personal-marks";
import type { InboxEntry, WsServerEvent } from "@/lib/conversations/types";

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

import { usePersonalMarks } from "./use-personal-marks";

const ana = { entry_id: "a", entry_type: "whatsapp" } as InboxEntry;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

function setup({ sendWorks = true } = {}) {
  const sent: { type: string; payload: Record<string, unknown> }[] = [];
  const hook = renderHook(
    () =>
      usePersonalMarks({
        send: (type, payload) => {
          sent.push({ type, payload });
          return sendWorks;
        },
      }),
    { wrapper },
  );
  const deliver = (event: WsServerEvent) => {
    let consumed = false;
    act(() => {
      consumed = hook.result.current.observe(event);
    });
    return consumed;
  };
  return { hook, sent, deliver };
}

describe("personal marks over the socket", () => {
  beforeEach(() => toastError.mockReset());

  it("pins at once with a request id and undoes the pin when the server refuses that request", () => {
    const { hook, sent, deliver } = setup();
    act(() => {
      hook.result.current.commands.pin(ana, true);
    });
    expect(sent[0]).toMatchObject({ type: "pin_conversation", payload: { entry_id: "a", entry_type: "whatsapp", pinned: true } });
    expect(isPinned(hook.result.current.commands.marks, ana)).toBe(true);

    const consumed = deliver({
      type: "conversation:error",
      payload: { code: "not_allowed", message: "no", request_id: sent[0].payload.request_id as string, entry_id: "a", entry_type: "whatsapp" },
    });
    expect(consumed).toBe(true);
    expect(isPinned(hook.result.current.commands.marks, ana)).toBe(false);
    expect(toastError).toHaveBeenCalledWith(ptMessages.crmInbox.personal.errors.not_allowed);
  });

  it("leaves errors of other commands to the rest of the socket handling", () => {
    const { deliver } = setup();
    expect(deliver({ type: "conversation:error", payload: { code: "not_found", message: "", request_id: "send-1" } })).toBe(false);
  });

  it("marks unread with its own command", () => {
    const { hook, sent } = setup();
    act(() => {
      hook.result.current.commands.markUnread(ana);
    });
    expect(sent.map((message) => message.type)).toEqual(["mark_unread"]);
    expect(isMarkedUnread(hook.result.current.commands.marks, ana)).toBe(true);
  });

  it("clears only the personal unread mark, so no message is marked read and the customer gets no receipt", () => {
    const { hook, sent } = setup();
    act(() => {
      hook.result.current.commands.markUnread(ana);
      hook.result.current.commands.clearUnreadMark(ana);
    });
    expect(sent.map((message) => message.type)).toEqual(["mark_unread", "clear_unread_mark"]);
    expect(sent[1].payload).toEqual({ entry_id: "a", entry_type: "whatsapp", request_id: expect.any(String) });
    expect(isMarkedUnread(hook.result.current.commands.marks, ana)).toBe(false);
  });

  it("restores the unread mark when the server refuses to clear it", () => {
    const { hook, sent, deliver } = setup();
    deliver({ type: "conversation:personal_mark", payload: { entry_id: "a", entry_type: "whatsapp", mark: { unread_marked_at: "2026-10-18T10:00:00Z" } } });
    act(() => {
      hook.result.current.commands.clearUnreadMark(ana);
    });
    expect(isMarkedUnread(hook.result.current.commands.marks, ana)).toBe(false);
    deliver({
      type: "conversation:error",
      payload: { code: "not_found", message: "", request_id: sent[0].payload.request_id as string, entry_id: "a", entry_type: "whatsapp" },
    });
    expect(isMarkedUnread(hook.result.current.commands.marks, ana)).toBe(true);
  });

  it("changes nothing and says so when the socket is closed", () => {
    const { hook } = setup({ sendWorks: false });
    let accepted = true;
    act(() => {
      accepted = hook.result.current.commands.pin(ana, true);
    });
    expect(accepted).toBe(false);
    expect(hook.result.current.commands.marks.size).toBe(0);
    expect(toastError).toHaveBeenCalledWith(ptMessages.crmInbox.personal.errors.connection);
  });

  it("reads the marks of an inbox page", () => {
    const { hook, deliver } = setup();
    deliver({
      type: "conversation:inbox",
      payload: { entries: [ana], page: 1, page_size: 20, total_items: 1, total_pages: 1, personal_marks: [{ entry_id: "a", entry_type: "whatsapp", pinned_at: "2026-10-18T10:00:00Z" }] },
    });
    expect(isPinned(hook.result.current.commands.marks, ana)).toBe(true);
  });

  it("asks the server for nothing when a mark changes by itself, since the server sends the row itself", () => {
    const { hook, sent, deliver } = setup();
    deliver({ type: "conversation:personal_mark", payload: { entry_id: "a", entry_type: "whatsapp", mark: { unread_marked_at: "2026-10-18T10:00:00Z" } } });
    deliver({ type: "conversation:personal_mark", payload: { entry_id: "a", entry_type: "whatsapp", mark: null } });
    expect(sent).toEqual([]);
    expect(isMarkedUnread(hook.result.current.commands.marks, ana)).toBe(false);
  });
});
