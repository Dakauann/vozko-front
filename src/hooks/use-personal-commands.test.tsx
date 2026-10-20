import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { PersonalInboxControls } from "@/hooks/use-personal-marks";
import { NO_PERSONAL_MARKS, withMark } from "@/lib/conversations/personal-marks";

const sonner = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("sonner", () => sonner);

import { usePersonalCommands } from "./use-personal-commands";

const open = { entry_id: "a", entry_type: "whatsapp" as const, unread_count: 0 };

function controls(marks = NO_PERSONAL_MARKS): PersonalInboxControls {
  return { marks, pin: vi.fn(() => true), markUnread: vi.fn(() => true), clearUnreadMark: vi.fn(() => true), clearUnread: vi.fn() };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("personal commands for the open conversation", () => {
  it("offers pin and mark unread from the palette and the thread keys", () => {
    const personal = controls();
    const { result } = renderHook(() => usePersonalCommands(open, personal), { wrapper });
    expect(result.current.map((command) => command.id)).toEqual(["conversation.pin", "conversation.markUnread"]);
    result.current[0].run();
    expect(personal.pin).toHaveBeenCalledWith(open, true);
  });

  it("offers mark unread on a conversation with unread messages, since the personal mark outlives a teammate reading them", () => {
    const { result } = renderHook(() => usePersonalCommands({ ...open, unread_count: 3 }, controls()), { wrapper });
    expect(result.current.map((command) => command.id)).toContain("conversation.markUnread");
  });

  it("undoes mark unread by clearing only the personal mark", async () => {
    const personal = controls();
    const { result } = renderHook(() => usePersonalCommands({ ...open, unread_count: 3 }, personal), { wrapper });
    await act(async () => {
      result.current.find((command) => command.id === "conversation.markUnread")!.run();
    });
    const [, options] = sonner.toast.mock.calls.at(-1) as unknown as [string, { action: { onClick: () => void } }];
    act(() => options.action.onClick());
    expect(personal.markUnread).toHaveBeenCalledWith(expect.objectContaining({ entry_id: "a" }));
    expect(personal.clearUnreadMark).toHaveBeenCalledWith(expect.objectContaining({ entry_id: "a" }));
  });

  it("leaves mark unread out when the conversation is already marked unread", () => {
    const marks = withMark(NO_PERSONAL_MARKS, open, { unread_marked_at: "2026-10-18T10:00:00Z" });
    const { result } = renderHook(() => usePersonalCommands(open, controls(marks)), { wrapper });
    expect(result.current.map((command) => command.id)).not.toContain("conversation.markUnread");
  });

  it("offers nothing without an open conversation or without the socket controls", () => {
    expect(renderHook(() => usePersonalCommands(null, controls()), { wrapper }).result.current).toEqual([]);
    expect(renderHook(() => usePersonalCommands(open, undefined), { wrapper }).result.current).toEqual([]);
  });
});
