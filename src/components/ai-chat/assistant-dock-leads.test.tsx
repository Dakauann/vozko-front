import { act, cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";

const conversation = vi.hoisted(() => ({ view: undefined as unknown }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, permissionsLoading: false, can: () => true }),
}));
vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/dashboard/leads",
  Link: ({ children, ...props }: { children: React.ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("./use-chat-conversation", () => ({
  useChatConversation: ({ view }: { view?: unknown }) => {
    conversation.view = view;
    return { messages: [], activeId: null, loadingThread: false, streaming: false, error: null, ask: vi.fn(), selectThread: vi.fn(), newChat: vi.fn(), stop: vi.fn(), resolveAction: vi.fn() };
  },
}));
vi.mock("./use-chat-model", () => ({ useChatModel: () => ({ model: "test", models: ["test"], pricing: [], changeModel: vi.fn() }) }));
vi.mock("./use-chat-attachments", () => ({ useChatAttachments: () => ({ items: [], ready: [], uploading: false, error: null, clear: vi.fn(), add: vi.fn(), attach: vi.fn(), remove: vi.fn() }) }));
vi.mock("./use-stick-to-bottom", () => ({ useStickToBottom: () => ({ scrollRef: { current: null }, onScroll: vi.fn(), showScrollDown: false, scrollToBottom: vi.fn() }) }));
vi.mock("./voice/use-voice-mode", () => ({ useVoiceMode: () => ({ disable: vi.fn(), enable: vi.fn(), phase: "off", supported: false }) }));

import { setDockOpen } from "@/lib/aichat/dock-state";
import type { LeadsAssistantContext } from "@/lib/aichat/assistant-context";

import { usePublishAssistantContext } from "./assistant-context";
import { AssistantDock } from "./assistant-dock";

const leads: LeadsAssistantContext = {
  kind: "leads",
  view: {
    surface: "leads",
    leadFilter: { groups: [{ conjunction: "and", predicates: [{ field: "owner", operator: "eq", values: ["u-1"] }] }] },
    selectedLeads: 1840,
  },
  scope: { filter: "Filtro com 1 condição", selected: "1.840 leads selecionados" },
};

function LeadsScreen() {
  usePublishAssistantContext(leads);
  return null;
}

afterEach(() => {
  cleanup();
  act(() => setDockOpen(false));
});

describe("AssistantDock on the leads screen", () => {
  it("greets for leads, shows what Elo sees and sends the leads view with every message", () => {
    act(() => setDockOpen(true));
    render(
      <NextIntlClientProvider locale="pt" messages={pt}>
        <LeadsScreen />
        <AssistantDock />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(pt.leadsPage.assistant.greeting)).toBeInTheDocument();
    expect(screen.getByText(pt.leadsPage.assistant.description)).toBeInTheDocument();
    expect(screen.getByText("Filtro com 1 condição")).toBeInTheDocument();
    expect(screen.getByText("1.840 leads selecionados")).toBeInTheDocument();
    expect(conversation.view).toEqual(leads.view);
  });
});
