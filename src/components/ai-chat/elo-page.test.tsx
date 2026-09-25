import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { AIChatClient } from "@/app/[locale]/dashboard/ai-chat/_components/ai-chat-client";

const mocks = vi.hoisted(() => ({
  ask: vi.fn(), select: vi.fn(), remove: vi.fn(), create: vi.fn(),
  loading: false, streaming: false,
}));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "workspace" }, can: (resource: string) => resource === "agents" }) }));
vi.mock("@/app/actions/aichat", () => ({
  listChatThreadsAction: async () => ({ data: { items: [{ id: "one", title: "Team report" }, { id: "two", title: "Agent setup" }] } }),
  deleteChatThreadAction: (id: string) => mocks.remove(id),
}));
vi.mock("./use-chat-conversation", () => ({ useChatConversation: () => ({
  messages: [], activeId: null, loadingThread: mocks.loading, streaming: mocks.streaming,
  error: null, ask: mocks.ask, selectThread: mocks.select, newChat: mocks.create, stop: vi.fn(), resolveAction: vi.fn(),
}) }));
vi.mock("./use-chat-model", () => ({ useChatModel: () => ({ model: "test", models: ["test"], pricing: [], changeModel: vi.fn() }) }));
vi.mock("./use-chat-attachments", () => ({ useChatAttachments: () => ({ items: [], ready: [], uploading: false, error: null, clear: vi.fn(), add: vi.fn(), remove: vi.fn() }) }));
vi.mock("./use-stick-to-bottom", () => ({ useStickToBottom: () => ({ scrollRef: { current: null }, onScroll: vi.fn(), showScrollDown: false, scrollToBottom: vi.fn() }) }));
vi.mock("@/components/elevated-design/ai-model-selector", () => ({ AIModelSelector: () => <span>Test model</span> }));

function mount() {
  return render(<NextIntlClientProvider locale="en" messages={en}><AIChatClient /></NextIntlClientProvider>);
}

beforeEach(() => { vi.clearAllMocks(); mocks.loading = false; mocks.streaming = false; mocks.remove.mockResolvedValue({ error: null }); });
afterEach(cleanup);

describe("Elo workspace chat", () => {
  it("offers permitted starters and moves the draft into the composer without sending", async () => {
    mount();
    await screen.findByText("Team report");
    const question = en.aiChatPage.dock.groups.agents.items.list;
    fireEvent.click(screen.getByRole("button", { name: new RegExp(question) }));
    expect(screen.getByRole("textbox", { name: en.aiChatPage.eloPlaceholder })).toHaveValue(question);
    expect(screen.getByRole("textbox", { name: en.aiChatPage.eloPlaceholder })).toHaveFocus();
    expect(mocks.ask).not.toHaveBeenCalled();
    expect(screen.queryByText(en.aiChatPage.dock.groups.campaigns.items.results)).not.toBeInTheDocument();
  });

  it("opens searchable mobile history and closes it when a conversation is selected", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: en.aiChatPage.threadsLegend }));
    const history = within(screen.getByRole("dialog"));
    fireEvent.change(history.getByRole("textbox", { name: en.aiChatPage.searchHistory }), { target: { value: "Team" } });
    await waitFor(() => expect(history.queryByText("Agent setup")).not.toBeInTheDocument());
    fireEvent.click(await history.findByRole("button", { name: "Team report" }));
    expect(mocks.select).toHaveBeenCalledWith("one");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps a conversation in history if deleting it fails", async () => {
    mocks.remove.mockResolvedValue({ error: "failed" });
    mount();
    await screen.findByText("Team report");
    fireEvent.click(screen.getAllByRole("button", { name: en.aiChatPage.deleteConversation })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent(en.aiChatPage.deleteError);
    expect(screen.getByText("Team report")).toBeInTheDocument();
  });

  it("blocks composing and switching conversations while a thread is loading", async () => {
    mocks.loading = true;
    mount();
    expect(screen.getByRole("status")).toHaveTextContent(en.aiChatPage.loading);
    expect(screen.getByRole("textbox", { name: en.aiChatPage.eloPlaceholder })).toBeDisabled();
    expect(await screen.findByRole("button", { name: "Team report" })).toBeDisabled();
    expect(screen.getByRole("button", { name: en.aiChatPage.send })).toBeDisabled();
  });

  it("sends with Enter but preserves composition and Shift+Enter", async () => {
    mount();
    await screen.findByText("Team report");
    const input = screen.getByRole("textbox", { name: en.aiChatPage.eloPlaceholder });
    fireEvent.change(input, { target: { value: "Hello Elo" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(mocks.ask).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mocks.ask).toHaveBeenCalledWith("Hello Elo", "test", []);
  });
});
