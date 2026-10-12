import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/messages/en.json";
import { activeThreadKey } from "@/lib/aichat/active-thread";
import type { StudioAssistantContext } from "@/lib/aichat/assistant-context";
import { setDockOpen } from "@/lib/aichat/dock-state";
import type { ChatThread } from "@/lib/aichat/types";
import { chatTurns } from "@/lib/aichat/turn-store";

const actions = vi.hoisted(() => ({ list: vi.fn(), messages: vi.fn(), cost: vi.fn() }));
const stream = vi.hoisted(() => ({ read: vi.fn() }));

vi.mock("@/app/actions/aichat", () => ({
  listChatThreadsAction: (...args: unknown[]) => actions.list(...args),
  deleteChatThreadAction: vi.fn(),
  getChatMessagesAction: (...args: unknown[]) => actions.messages(...args),
  getChatThreadCostAction: (...args: unknown[]) => actions.cost(...args),
  createChatThreadAction: vi.fn(),
  stopChatTurnAction: vi.fn(),
  queueChatMessageAction: vi.fn(),
  unqueueChatMessageAction: vi.fn(),
}));
vi.mock("@/lib/aichat/chat-stream", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/aichat/chat-stream")>();
  return { ...actual, readChatStream: (...args: unknown[]) => stream.read(...args) };
});
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, permissionsLoading: false, can: () => true }),
}));
vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/dashboard/studio/image/p-open",
  Link: ({ children, ...props }: { children: React.ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("./use-chat-model", () => ({ useChatModel: () => ({ model: "test", models: ["test"], pricing: [], changeModel: vi.fn() }) }));
vi.mock("./use-chat-attachments", () => ({ useChatAttachments: () => ({ items: [], ready: [], uploading: false, error: null, clear: vi.fn(), add: vi.fn(), attach: vi.fn(), remove: vi.fn() }) }));
vi.mock("./use-stick-to-bottom", () => ({ useStickToBottom: () => ({ scrollRef: { current: null }, onScroll: vi.fn(), showScrollDown: false, scrollToBottom: vi.fn() }) }));
vi.mock("./voice/use-voice-mode", () => ({ useVoiceMode: () => ({ disable: vi.fn(), enable: vi.fn(), phase: "off", supported: false }) }));
vi.mock("@/components/elevated-design/ai-model-selector", () => ({ AIModelSelector: () => <span>Test model</span> }));

import { usePublishAssistantContext } from "./assistant-context";
import { AssistantDock } from "./assistant-dock";

const studio: StudioAssistantContext = { kind: "studio", view: { surface: "studio", projectId: "p-open", projectKind: "image" }, projectName: "Campanha de outubro" };

const now = new Date().toISOString();
const here: ChatThread = { id: "th-here", title: "Banner deste projeto", model: "m", createdAt: now, projectId: "p-open" };
const elsewhere: ChatThread = { id: "th-elsewhere", title: "Story de outro projeto", model: "m", createdAt: now, projectId: "p-other" };

function history(threadId: string) {
  const projectId = threadId === elsewhere.id ? "p-other" : "p-open";
  return { data: { items: [{ id: `m-${threadId}`, role: "user", content: `conversa ${threadId}`, createdAt: now }], total: 1, page: 1, pageSize: 100, running: false, projectId }, error: null };
}

function StudioScreen() {
  usePublishAssistantContext(studio);
  return null;
}

function mount() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <StudioScreen />
      <AssistantDock />
    </NextIntlClientProvider>,
  );
}

async function openSessions() {
  fireEvent.click(screen.getByRole("button", { name: en.aiChatPage.threadsLegend }));
  return within(await screen.findByRole("dialog", { name: en.aiChatPage.threadsLegend }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  actions.list.mockResolvedValue({ data: { items: [here, elsewhere], total: 2, page: 1, pageSize: 30 }, error: null });
  actions.messages.mockImplementation(async (threadId: string) => history(threadId));
  actions.cost.mockResolvedValue({ data: null, error: null });
  act(() => setDockOpen(true));
});

afterEach(() => {
  cleanup();
  act(() => setDockOpen(false));
});

describe("the dock session picker", () => {
  it("opens from the header, focuses the search, and switches the dock to the chosen session for this workspace", { timeout: 15_000 }, async () => {
    mount();
    const sessions = await openSessions();
    await waitFor(() => expect(sessions.getByRole("textbox", { name: en.aiChatPage.searchHistory })).toHaveFocus());
    expect(sessions.getByText(en.aiChatPage.sessions.places.here)).toBeInTheDocument();

    fireEvent.click(await sessions.findByRole("button", { name: here.title }));
    expect(await screen.findByText("conversa th-here")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: en.aiChatPage.threadsLegend })).not.toBeInTheDocument());
    expect(actions.messages).toHaveBeenCalledWith("th-here");
    expect(localStorage.getItem(activeThreadKey("ws-1"))).toBe("th-here");
    const composer = screen.getByRole("textbox", { name: en.aiChatPage.inputPlaceholder });
    expect(composer).not.toBeDisabled();
    await waitFor(() => expect(composer).toHaveFocus());
  });

  it("labels a session from another studio project and refuses to continue it here, with a way out", { timeout: 15_000 }, async () => {
    mount();
    const sessions = await openSessions();
    expect(await sessions.findByText(en.aiChatPage.sessions.places.other_project)).toBeInTheDocument();
    fireEvent.click(sessions.getByRole("button", { name: elsewhere.title }));

    expect(await screen.findByText(en.aiChatPage.sessions.otherProject)).toBeInTheDocument();
    expect(screen.getByText("conversa th-elsewhere")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: en.aiChatPage.inputPlaceholder })).toBeDisabled();
    const startOver = within(screen.getByRole("status")).getByRole("button", { name: en.aiChatPage.newChat });
    await waitFor(() => expect(startOver).toHaveFocus());

    fireEvent.click(startOver);
    await waitFor(() => expect(screen.queryByText(en.aiChatPage.sessions.otherProject)).not.toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: en.aiChatPage.inputPlaceholder })).not.toBeDisabled();
    expect(localStorage.getItem(activeThreadKey("ws-1"))).toBeNull();
  });

  it("closes the list with Escape without minimizing the dock", { timeout: 15_000 }, async () => {
    mount();
    await openSessions();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: en.aiChatPage.threadsLegend })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: en.studio.agent.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.aiChatPage.threadsLegend })).toHaveFocus();
  });

  it("shows on the header when Elo is working in another session", { timeout: 15_000 }, async () => {
    mount();
    expect(screen.queryByText(en.aiChatPage.sessions.runningElsewhere)).not.toBeInTheDocument();
    act(() => {
      chatTurns.begin("th-background");
    });
    expect(screen.getByText(en.aiChatPage.sessions.runningElsewhere)).toBeInTheDocument();
    act(() => chatTurns.end("th-background"));
    expect(screen.queryByText(en.aiChatPage.sessions.runningElsewhere)).not.toBeInTheDocument();
  });
});
