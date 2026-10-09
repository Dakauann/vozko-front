import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/messages/en.json";

const access = vi.hoisted(() => ({ loading: false, allowed: true, mounts: 0 }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: "ws-1" },
    permissionsLoading: access.loading,
    can: () => !access.loading && access.allowed,
  }),
}));
vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/dashboard/studio/image/p1",
  Link: ({ children, ...props }: { children: React.ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("./use-chat-conversation", () => ({
  useChatConversation: () => {
    useEffect(() => {
      access.mounts += 1;
    }, []);
    return { messages: [], activeId: null, loadingThread: false, streaming: false, error: null, ask: vi.fn(), selectThread: vi.fn(), newChat: vi.fn(), stop: vi.fn(), resolveAction: vi.fn() };
  },
}));
vi.mock("./use-chat-model", () => ({ useChatModel: () => ({ model: "test", models: ["test"], pricing: [], changeModel: vi.fn() }) }));
vi.mock("./use-chat-attachments", () => ({ useChatAttachments: () => ({ items: [], ready: [], uploading: false, error: null, clear: vi.fn(), add: vi.fn(), attach: vi.fn(), remove: vi.fn() }) }));
vi.mock("./use-stick-to-bottom", () => ({ useStickToBottom: () => ({ scrollRef: { current: null }, onScroll: vi.fn(), showScrollDown: false, scrollToBottom: vi.fn() }) }));
vi.mock("./voice/use-voice-mode", () => ({ useVoiceMode: () => ({ disable: vi.fn() }) }));

import { AssistantDock } from "./assistant-dock";

function Dock() {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <AssistantDock />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  access.loading = false;
  access.allowed = true;
  access.mounts = 0;
});
afterEach(cleanup);

describe("AssistantDock access gate", () => {
  it("keeps the conversation mounted while permissions reload", () => {
    const view = render(<Dock />);
    expect(screen.getByRole("button", { name: en.aiChatPage.dock.open })).toBeInTheDocument();
    access.loading = true;
    view.rerender(<Dock />);
    access.loading = false;
    view.rerender(<Dock />);
    expect(access.mounts).toBe(1);
  });

  it("shows nothing before permissions first settle", () => {
    access.loading = true;
    render(<Dock />);
    expect(screen.queryByRole("button", { name: en.aiChatPage.dock.open })).not.toBeInTheDocument();
  });

  it("shows nothing without the permission", () => {
    access.allowed = false;
    render(<Dock />);
    expect(screen.queryByRole("button", { name: en.aiChatPage.dock.open })).not.toBeInTheDocument();
  });
});
