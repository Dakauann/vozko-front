import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/messages/en.json";
import { THREAD_PAGE_SIZE } from "@/lib/aichat/thread-list";
import { chatTurns } from "@/lib/aichat/turn-store";
import type { ChatThread } from "@/lib/aichat/types";

const actions = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn() }));

vi.mock("@/app/actions/aichat", () => ({
  listChatThreadsAction: (...args: unknown[]) => actions.list(...args),
  deleteChatThreadAction: (...args: unknown[]) => actions.remove(...args),
}));

import { ChatThreadList } from "./chat-thread-list";
import { useChatThreads } from "./use-chat-threads";

const today = new Date().toISOString();

const banner: ChatThread = { id: "th-banner", title: "Banner de outubro", model: "m", createdAt: today, lastMessageAt: today, projectId: "p-open" };
const story: ChatThread = { id: "th-story", title: "Story da promoção", model: "m", createdAt: today, projectId: "p-other", running: true };
const report: ChatThread = { id: "th-report", title: "Relatório da equipe", model: "m", createdAt: today };
const older: ChatThread = { id: "th-older", title: "Agente de cobrança", model: "m", createdAt: "2025-03-02T09:00:00Z" };

function page(items: ChatThread[], total: number) {
  return { data: { items, total, page: 1, pageSize: THREAD_PAGE_SIZE }, error: null };
}

interface HarnessProps {
  activeId?: string | null;
  projectId?: string;
  disabled?: boolean;
  onPick?: (id: string) => void;
  onActiveRemoved?: () => void;
}

function Harness({ activeId = null, projectId, disabled = false, onPick = vi.fn(), onActiveRemoved = vi.fn() }: HarnessProps) {
  const threads = useChatThreads(true);
  return <ChatThreadList threads={threads} activeId={activeId} projectId={projectId} disabled={disabled} onPick={onPick} onActiveRemoved={onActiveRemoved} />;
}

function mount(props: HarnessProps = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Harness {...props} />
    </NextIntlClientProvider>,
  );
}

function row(title: string) {
  return screen.getByRole("button", { name: title }).closest("li") as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  actions.list.mockResolvedValue(page([banner, story, report], 4));
  actions.remove.mockResolvedValue({ error: null });
});

afterEach(cleanup);

describe("the shared session list", () => {
  it("shows each session with its title, last activity, studio place and a live indicator when Elo is working", { timeout: 15_000 }, async () => {
    mount({ activeId: "th-report", projectId: "p-open" });
    await screen.findByRole("button", { name: banner.title });
    expect(actions.list).toHaveBeenCalledWith(1, THREAD_PAGE_SIZE, "");

    const bannerRow = within(row(banner.title));
    expect(bannerRow.getByText(en.aiChatPage.sessions.places.here)).toBeInTheDocument();
    expect(bannerRow.getByText(new Date(today).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }))).toBeInTheDocument();
    expect(bannerRow.queryByText(en.aiChatPage.sessions.running)).not.toBeInTheDocument();

    const storyRow = within(row(story.title));
    expect(storyRow.getByText(en.aiChatPage.sessions.places.other_project)).toBeInTheDocument();
    expect(storyRow.getByText(en.aiChatPage.sessions.running)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: report.title })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: banner.title })).toHaveAccessibleDescription(expect.stringContaining(en.aiChatPage.sessions.places.here));
  });

  it("marks a session as running while this browser streams its answer, and refreshes the list when it ends", { timeout: 15_000 }, async () => {
    mount();
    await screen.findByRole("button", { name: report.title });
    expect(within(row(report.title)).queryByText(en.aiChatPage.sessions.running)).not.toBeInTheDocument();

    act(() => {
      chatTurns.begin("th-report");
    });
    expect(within(row(report.title)).getByText(en.aiChatPage.sessions.running)).toBeInTheDocument();
    expect(within(row(report.title)).getByRole("button", { name: en.aiChatPage.deleteConversation })).toBeDisabled();

    actions.list.mockResolvedValue(page([{ ...report, title: "Relatório pronto" }, banner, story], 4));
    act(() => chatTurns.end("th-report"));
    expect(await screen.findByRole("button", { name: "Relatório pronto" })).toBeInTheDocument();
    expect(within(row("Relatório pronto")).queryByText(en.aiChatPage.sessions.running)).not.toBeInTheDocument();
  });

  it("loads the next page on demand", { timeout: 15_000 }, async () => {
    mount();
    await screen.findByRole("button", { name: banner.title });
    actions.list.mockResolvedValueOnce({ data: { items: [older], total: 4, page: 2, pageSize: THREAD_PAGE_SIZE }, error: null });
    fireEvent.click(screen.getByRole("button", { name: en.aiChatPage.sessions.loadMore }));
    expect(await screen.findByRole("button", { name: older.title })).toBeInTheDocument();
    expect(actions.list).toHaveBeenLastCalledWith(2, THREAD_PAGE_SIZE, "");
    expect(screen.queryByRole("button", { name: en.aiChatPage.sessions.loadMore })).not.toBeInTheDocument();
  });

  it("narrows the list as the person types and asks the server for matching titles", { timeout: 15_000 }, async () => {
    mount();
    await screen.findByRole("button", { name: banner.title });
    actions.list.mockResolvedValue(page([report, older], 2));
    fireEvent.change(screen.getByRole("textbox", { name: en.aiChatPage.searchHistory }), { target: { value: "equipe" } });
    expect(screen.queryByRole("button", { name: banner.title })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: report.title })).toBeInTheDocument();
    await waitFor(() => expect(actions.list).toHaveBeenLastCalledWith(1, THREAD_PAGE_SIZE, "equipe"));
    expect(screen.queryByRole("button", { name: older.title })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: en.aiChatPage.searchHistory }), { target: { value: "nada assim" } });
    expect(await screen.findByText(en.aiChatPage.noSearchResults)).toBeInTheDocument();
  });

  it("picks a session with the keyboard and stays put while switching is blocked", { timeout: 15_000 }, async () => {
    const onPick = vi.fn();
    const view = mount({ onPick });
    const button = await screen.findByRole("button", { name: story.title });
    button.focus();
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(button);
    expect(onPick).toHaveBeenCalledWith(story.id);

    view.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <Harness onPick={onPick} disabled />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: banner.title })).toBeDisabled();
  });

  it("starts a new conversation when the open session is deleted, and keeps the row when deleting fails", { timeout: 15_000 }, async () => {
    const onActiveRemoved = vi.fn();
    mount({ activeId: "th-banner", onActiveRemoved });
    await screen.findByRole("button", { name: banner.title });

    actions.remove.mockResolvedValueOnce({ error: "failed" });
    fireEvent.click(within(row(report.title)).getByRole("button", { name: en.aiChatPage.deleteConversation }));
    expect(await screen.findByRole("alert")).toHaveTextContent(en.aiChatPage.deleteError);
    expect(screen.getByRole("button", { name: report.title })).toBeInTheDocument();

    fireEvent.click(within(row(banner.title)).getByRole("button", { name: en.aiChatPage.deleteConversation }));
    await waitFor(() => expect(screen.queryByRole("button", { name: banner.title })).not.toBeInTheDocument());
    expect(actions.remove).toHaveBeenLastCalledWith("th-banner");
    expect(onActiveRemoved).toHaveBeenCalledTimes(1);
    expect(within(row(story.title)).getByRole("button", { name: en.aiChatPage.deleteConversation })).toBeDisabled();
  });

  it("says so when the list cannot load", { timeout: 15_000 }, async () => {
    actions.list.mockResolvedValue({ data: null, error: "boom" });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(en.aiChatPage.historyError);
  });
});
