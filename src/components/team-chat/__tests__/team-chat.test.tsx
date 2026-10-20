import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  getTeamChatSummaryAction: vi.fn(),
  listTeamChatThreadsAction: vi.fn(),
  getTeamChatThreadAction: vi.fn(),
  listTeamChatPeopleAction: vi.fn(),
  openDirectAction: vi.fn(),
  createGroupAction: vi.fn(),
  renameGroupAction: vi.fn(),
  addGroupMembersAction: vi.fn(),
  removeGroupMemberAction: vi.fn(),
  leaveGroupAction: vi.fn(),
  muteThreadAction: vi.fn(),
  listTeamChatMessagesAction: vi.fn(),
  sendTeamChatMessageAction: vi.fn(),
  editTeamChatMessageAction: vi.fn(),
  deleteTeamChatMessageAction: vi.fn(),
  markTeamChatReadAction: vi.fn(),
  listScheduledTeamMessagesAction: vi.fn(),
  scheduleTeamMessageAction: vi.fn(),
  rescheduleTeamMessageAction: vi.fn(),
  cancelScheduledTeamMessageAction: vi.fn(),
}));

const access = vi.hoisted(() => ({ allowed: new Set(["read", "send", "create"]) }));

vi.mock("@/app/actions/team-chat", () => actions);
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: "ws-1" },
    can: (resource: string, action: string) => resource === "team_chat" && access.allowed.has(action),
  }),
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u-me" } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import ptMessages from "@/i18n/messages/pt.json";
import { forgetTeamChatMessages } from "@/hooks/use-team-chat-messages";
import { setAttentionSink } from "@/lib/attention/signal";
import { emitTeamChat, registerTeamChatTypingSender } from "@/lib/team-chat/bus";
import { closeTeamChat } from "@/lib/team-chat/panel";
import type { TeamChatMessage, TeamChatThread } from "@/lib/team-chat/types";

import { TeamChatButton } from "../team-chat-button";
import { TeamChatDock } from "../team-chat-dock";

const copy = ptMessages.teamChat;

function message(seq: number, overrides: Partial<TeamChatMessage> = {}): TeamChatMessage {
  return {
    id: `m-${seq}`,
    thread_id: "t-dm",
    seq,
    author_id: "u-bia",
    author_name: "Bia",
    kind: "text",
    body: `oi ${seq}`,
    subject_ids: [],
    mentions: [],
    created_at: `2026-10-19T12:0${seq}:00Z`,
    ...overrides,
  };
}

function thread(id: string, overrides: Partial<TeamChatThread> = {}): TeamChatThread {
  return {
    id,
    kind: "direct",
    title: "",
    created_by: "u-me",
    last_seq: 2,
    last_message_at: "2026-10-19T12:02:00Z",
    created_at: "2026-10-19T09:00:00Z",
    me: { role: "member", last_read_seq: 1, muted: false },
    members: [
      { user_id: "u-me", name: "Eu", picture: "", role: "member", last_read_seq: 1 },
      { user_id: "u-bia", name: "Bia", picture: "", role: "member", last_read_seq: 2 },
    ],
    last_message: message(2),
    unread: 1,
    unread_mentions: 0,
    ...overrides,
  };
}

const group = thread("t-group", {
  kind: "group",
  title: "Vendas",
  last_message_at: "2026-10-19T11:00:00Z",
  last_seq: 1,
  me: { role: "admin", last_read_seq: 1, muted: true },
  members: [
    { user_id: "u-me", name: "Eu", picture: "", role: "admin", last_read_seq: 1 },
    { user_id: "u-bia", name: "Bia", picture: "", role: "member", last_read_seq: 1 },
    { user_id: "u-caio", name: "Caio", picture: "", role: "member", last_read_seq: 1 },
  ],
  last_message: message(1, { thread_id: "t-group", kind: "system", event: "created", author_id: "u-me", body: "Vendas" }),
  unread: 0,
});

function renderChat() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo" now={new Date("2026-10-19T12:10:00Z")}>
        <TeamChatButton />
        <TeamChatDock />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

async function openDock() {
  fireEvent.click(await screen.findByRole("button", { name: /^Equipe/ }));
  return screen.findByRole("complementary", { name: copy.title });
}

beforeEach(() => {
  vi.clearAllMocks();
  access.allowed = new Set(["read", "send", "create"]);
  actions.getTeamChatSummaryAction.mockResolvedValue({ data: { unread_threads: 1, unread_messages: 3 } });
  actions.listTeamChatThreadsAction.mockResolvedValue({ data: { threads: [thread("t-dm"), group], next: "" } });
  actions.getTeamChatThreadAction.mockImplementation((id: string) => Promise.resolve({ data: id === "t-group" ? group : thread("t-dm") }));
  actions.listTeamChatMessagesAction.mockResolvedValue({ data: { messages: [message(1, { author_id: "u-me", author_name: "Eu" }), message(2)], has_more: false } });
  actions.listScheduledTeamMessagesAction.mockResolvedValue({ data: [] });
  actions.listTeamChatPeopleAction.mockResolvedValue({ data: [{ user_id: "u-bia", name: "Bia", picture: "" }] });
  actions.markTeamChatReadAction.mockResolvedValue({ data: 2 });
  actions.sendTeamChatMessageAction.mockImplementation((_id: string, draft: { body: string; client_id: string; mentions: string[] }) =>
    Promise.resolve({ data: message(3, { author_id: "u-me", author_name: "Eu", body: draft.body, client_id: draft.client_id, mentions: draft.mentions }) }),
  );
});

afterEach(() => {
  act(() => closeTeamChat());
  forgetTeamChatMessages();
});

describe("team chat", () => {
  it("lets every member chat but offers groups only with team_chat:create", async () => {
    access.allowed = new Set();
    renderChat();
    const dock = await openDock();
    fireEvent.click(within(dock).getByRole("button", { name: copy.list.newChat }));
    expect(await within(dock).findByRole("heading", { name: copy.newChat.title })).toBeInTheDocument();
    expect(within(dock).queryByText(copy.newChat.startGroup)).not.toBeInTheDocument();
  });

  it("shows the unread count and opens the list with previews", async () => {
    renderChat();
    expect(await screen.findByRole("button", { name: "Equipe, 3 mensagens não lidas" })).toBeInTheDocument();
    const dock = await openDock();
    expect(await within(dock).findByText("Bia")).toBeInTheDocument();
    expect(within(dock).getByText("oi 2")).toBeInTheDocument();
    expect(within(dock).getByText("Vendas")).toBeInTheDocument();
    expect(within(dock).getByText("Você criou o grupo Vendas")).toBeInTheDocument();
    expect(within(dock).getByLabelText("Conversa silenciada")).toBeInTheDocument();
  });

  it("opens a thread and sends with a client id and the resolved mentions", async () => {
    renderChat();
    const dock = await openDock();
    fireEvent.click(await within(dock).findByText("oi 2"));
    expect(await within(dock).findByText("oi 1")).toBeInTheDocument();
    const box = within(dock).getByRole("textbox", { name: copy.composer.label });
    fireEvent.change(box, { target: { value: "@Bia pode ver?", selectionStart: 14 } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(actions.sendTeamChatMessageAction).toHaveBeenCalled());
    const [threadId, draft] = actions.sendTeamChatMessageAction.mock.calls[0];
    expect(threadId).toBe("t-dm");
    expect(draft).toMatchObject({ body: "@Bia pode ver?", mentions: ["u-bia"] });
    expect(draft.client_id).toMatch(/[0-9a-f-]{36}/);
    expect(await within(dock).findByText("@Bia pode ver?")).toBeInTheDocument();
  });

  it("marks the thread read once it is on screen", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    renderChat();
    const dock = await openDock();
    fireEvent.click(await within(dock).findByText("oi 2"));
    await waitFor(() => expect(actions.markTeamChatReadAction).toHaveBeenCalledWith("t-dm", 2), { timeout: 2_000 });
  });

  it("moves a live message to the top and asks for attention, quietly for a muted group unless it mentions me", async () => {
    const attended = vi.fn();
    const leave = setAttentionSink(attended);
    renderChat();
    const dock = await openDock();
    await within(dock).findByText("Vendas");

    act(() =>
      emitTeamChat({
        type: "team_chat:message",
        payload: { thread_id: "t-group", message: message(2, { id: "g-2", thread_id: "t-group", author_id: "u-caio", author_name: "Caio", body: "geral" }) },
      }),
    );
    act(() =>
      emitTeamChat({
        type: "team_chat:message",
        payload: { thread_id: "t-group", message: message(3, { id: "g-3", thread_id: "t-group", author_id: "u-caio", author_name: "Caio", body: "@Eu olha", mentions: ["u-me"] }) },
      }),
    );
    leave();

    await waitFor(() => expect(within(within(dock).getAllByRole("listitem")[0]).getByText("Vendas")).toBeInTheDocument());
    expect(attended.mock.calls.map((call) => [call[0].id, call[0].quiet, call[0].title])).toEqual([
      ["team:g-2", true, "Caio em Vendas"],
      ["team:g-3", false, "Caio em Vendas"],
    ]);
  });

  it("shows who is typing and sends my own typing at most every few seconds", async () => {
    const sender = vi.fn(() => true);
    const unregister = registerTeamChatTypingSender(sender);
    renderChat();
    const dock = await openDock();
    fireEvent.click(await within(dock).findByText("oi 2"));
    await within(dock).findByText("oi 1");

    act(() => emitTeamChat({ type: "team_chat:typing", payload: { thread_id: "t-dm", user_id: "u-bia" } }));
    expect(await within(dock).findByText(/Bia/, { selector: "span" })).toBeInTheDocument();

    const box = within(dock).getByRole("textbox", { name: copy.composer.label });
    fireEvent.change(box, { target: { value: "a" } });
    fireEvent.change(box, { target: { value: "ab" } });
    unregister();
    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender).toHaveBeenCalledWith("t-dm");
  });

  it("schedules a message instead of sending it", async () => {
    actions.scheduleTeamMessageAction.mockImplementation((_id: string, draft: { body: string; send_at: string }) =>
      Promise.resolve({
        data: { id: "s-1", thread_id: "t-dm", body: draft.body, mentions: [], send_at: draft.send_at, status: "pending", created_at: "", updated_at: "" },
      }),
    );
    renderChat();
    const dock = await openDock();
    fireEvent.click(await within(dock).findByText("oi 2"));
    await within(dock).findByText("oi 1");

    fireEvent.click(within(dock).getByRole("button", { name: copy.composer.schedule }));
    const box = within(dock).getByRole("textbox", { name: copy.composer.label });
    fireEvent.change(box, { target: { value: "lembrete" } });
    fireEvent.keyDown(box, { key: "Enter" });

    await waitFor(() => expect(actions.scheduleTeamMessageAction).toHaveBeenCalled());
    expect(actions.sendTeamChatMessageAction).not.toHaveBeenCalled();
    const [, draft] = actions.scheduleTeamMessageAction.mock.calls[0];
    expect(draft.body).toBe("lembrete");
    expect(new Date(draft.send_at).getTime()).toBeGreaterThan(Date.now() + 59 * 60_000);
  });
});
