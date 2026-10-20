import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useConversationUrl } from "./use-conversation-url";
import type { EntryType } from "@/lib/conversations/types";

interface Props {
  entryId: string | null;
  entryType: EntryType | null;
}

function setup(initial: Props, onNavigate = vi.fn()) {
  const hook = renderHook((props: Props) => useConversationUrl({ enabled: true, onNavigate, ...props }), { initialProps: initial });
  return { ...hook, onNavigate };
}

afterEach(() => {
  window.history.replaceState(null, "", "/dashboard/live-chat");
});

describe("the open conversation in the address bar", () => {
  it("writes nothing on the first render, so a shared link is never wiped before it opens", () => {
    window.history.replaceState(null, "", "/dashboard/live-chat?g=stage&entry=e-1&type=whatsapp");
    const push = vi.spyOn(window.history, "pushState");
    setup({ entryId: null, entryType: null });
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });

  it("adds a history entry per opened conversation and keeps the board params", () => {
    window.history.replaceState(null, "", "/dashboard/live-chat?g=label");
    const { rerender } = setup({ entryId: null, entryType: null });
    rerender({ entryId: "e-1", entryType: "whatsapp" });
    expect(window.location.search).toBe("?g=label&entry=e-1&type=whatsapp");
    rerender({ entryId: "e-2", entryType: "instagram" });
    expect(window.location.search).toBe("?g=label&entry=e-2&type=instagram");
  });

  it("follows back and forward to the conversation the address names, or to none", () => {
    const { onNavigate } = setup({ entryId: null, entryType: null });
    act(() => {
      window.history.replaceState(null, "", "/dashboard/live-chat?entry=e-1&type=telegram");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(onNavigate).toHaveBeenLastCalledWith({ entryId: "e-1", entryType: "telegram" });
    act(() => {
      window.history.replaceState(null, "", "/dashboard/live-chat");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(onNavigate).toHaveBeenLastCalledWith(null);
  });

  it("does not push again when the conversation came from the address itself", () => {
    window.history.replaceState(null, "", "/dashboard/live-chat?entry=e-1&type=whatsapp");
    const { rerender } = setup({ entryId: null, entryType: null });
    const push = vi.spyOn(window.history, "pushState");
    rerender({ entryId: "e-1", entryType: "whatsapp" });
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });
});
