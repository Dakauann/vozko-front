import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { CallSessionApi, CallSessionState } from "@/hooks/use-call-session-ws";

import { aList, aNext, anItem, MANAGER, MEMBERS, OUTCOME_CONFIG, renderWithProviders, WORKER, workspaceFor } from "./call-list-test-kit";

const granted = vi.hoisted(() => ({ value: new Set<string>() }));
const session = vi.hoisted(() => ({ value: null as unknown as CallSessionApi }));
const actions = vi.hoisted(() => ({
  getCallListAction: vi.fn(),
  updateCallListAction: vi.fn(),
  deleteCallListAction: vi.fn(),
  listCallListItemsAction: vi.fn(),
  nextCallListItemAction: vi.fn(),
  releaseCallListItemAction: vi.fn(),
  closeCallListItemAction: vi.fn(),
  listCallListsAction: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => workspaceFor(granted.value) }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u-me" } }) }));
vi.mock("@/contexts/call-session-context", () => ({ useCallSession: () => session.value }));
vi.mock("@/app/actions/call-lists", () => actions);
vi.mock("@/app/actions/workspace", () => ({ listAssignableMembersAction: () => Promise.resolve(MEMBERS) }));
vi.mock("@/app/actions/workspace-config", () => ({ getWorkspaceConfigAction: () => Promise.resolve(OUTCOME_CONFIG) }));
vi.mock("@/app/actions/call-routing", () => ({ listTransferQueuesAction: () => Promise.resolve({ queues: [] }) }));
vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dashboard/call-lists/list-1",
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn(), warning: vi.fn() } }));

import { callSurfaceOwner, releaseCallSurface, subscribeCallRequest, type CallRequest } from "@/lib/call-session/call-session-control";
import { rememberTrunk } from "@/lib/dialer/dial-lines";

import { CallListWorkerPage } from "../CallListWorkerPage";

const copy = pt.callLists;

function connected(overrides: Partial<CallSessionApi> = {}) {
  session.value = {
    status: "connected",
    callState: null,
    lastError: null,
    lastErrorCode: null,
    muted: false,
    setMuted: vi.fn(),
    startCall: vi.fn(),
    endCall: vi.fn(),
    clearError: vi.fn(),
    incomingCall: null,
    acceptIncomingCall: vi.fn(),
    declineIncomingCall: vi.fn(),
    selfUserId: "u-me",
    presence: [],
    transfer: null,
    transferCall: vi.fn(),
    cancelTransfer: vi.fn(),
    ...overrides,
  } as unknown as CallSessionApi;
}

let requests: CallRequest[] = [];
let unsubscribe: () => void = () => {};

function withCall(state: CallSessionState | null, lastErrorCode: string | null = null) {
  session.value = { ...session.value, callState: state, lastErrorCode };
}

function dialedRequest(): string {
  const requestId = requests.at(-1)?.requestId;
  if (!requestId) throw new Error("no call was requested");
  return requestId;
}

function callFor(status: CallSessionState["status"], overrides: Partial<CallSessionState> = {}): CallSessionState {
  return { phoneNumber: "5511900010142", status, channel: "sip", requestId: dialedRequest(), ...overrides };
}

function stampedByTheServer() {
  actions.listCallListItemsAction.mockResolvedValue({ data: { items: [anItem({ lastCallId: "rec-me", closable: true })] }, error: null });
}

async function callAndEnd(view: { rerender: (node: ReactNode) => void }) {
  stampedByTheServer();
  fireEvent.click(screen.getByRole("button", { name: copy.call.call }));
  act(() => withCall(callFor("answered", { callId: "call-1", answeredAt: Date.now() })));
  view.rerender(<CallListWorkerPage listId="list-1" />);
  act(() => withCall(callFor("ended", { callId: "call-1", reason: "completed", durationSeconds: 134 })));
  view.rerender(<CallListWorkerPage listId="list-1" />);
  act(() => withCall(null));
  view.rerender(<CallListWorkerPage listId="list-1" />);
  await screen.findByText(/^Chamada encerrada/);
}

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function renderPage() {
  const view = renderWithProviders(<CallListWorkerPage listId="list-1" />);
  await screen.findByRole("heading", { name: aList().name });
  return view;
}

async function takeNext() {
  fireEvent.click(await screen.findByRole("button", { name: copy.next.start }));
  return screen.findByText("Maria Aparecida Souza");
}

describe("CallListWorkerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    granted.value = new Set(WORKER);
    connected();
    requests = [];
    unsubscribe = subscribeCallRequest((request) => requests.push(request));
    actions.getCallListAction.mockResolvedValue({ data: aList(), error: null });
    actions.listCallListItemsAction.mockResolvedValue({ data: { items: [] }, error: null });
    actions.nextCallListItemAction.mockResolvedValue({ data: aNext(), error: null });
    actions.closeCallListItemAction.mockResolvedValue({ data: anItem({ state: "closed" }), error: null });
    actions.releaseCallListItemAction.mockResolvedValue({ data: anItem({ state: "pending" }), error: null });
  });

  afterEach(() => {
    unsubscribe();
    releaseCallSurface("call_list");
    window.localStorage.clear();
  });

  it("shows the list's progress and claims the call surface for the member who calls it", async () => {
    await renderPage();
    expect(screen.getByText(copy.progress.total)).toBeInTheDocument();
    expect(screen.getByText("1.204")).toBeInTheDocument();
    expect(screen.getByText("812")).toBeInTheDocument();
    expect(screen.getByText("392")).toBeInTheDocument();
    expect(screen.getByText("96")).toBeInTheDocument();
    expect(screen.getByText(copy.progress.called)).toBeInTheDocument();
    expect(screen.getByText("341")).toBeInTheDocument();
    expect(screen.getByText(copy.progress.callbacks)).toBeInTheDocument();
    expect(screen.getByText("26")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: copy.progress.label })).toHaveAttribute("aria-valuenow", "32");
    await waitFor(() => expect(callSurfaceOwner()).toBe("call_list"));
  });

  it("serves the next contact with its context and calls it through the call plumbing", async () => {
    await renderPage();
    await takeNext();
    expect(actions.nextCallListItemAction).toHaveBeenCalledWith("list-1");
    expect(screen.getByText("Jardim Silveira · Barueri")).toBeInTheDocument();
    expect(screen.getByText("2 familiares cadastrados")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Conversa em / })).toHaveAttribute("href", "/dashboard/live-chat?entry=e-1&type=whatsapp");
    expect(screen.getByText("+55 (11) 90001-0142")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: copy.call.call }));
    expect(requests).toEqual([
      { phoneNumber: "5511900010142", trunkId: "t-1", leadId: "lead-1", callListItemId: "item-1", requestId: expect.any(String), label: "Linha Barueri 1" },
    ]);
  });

  it("asks for a call before the outcome and saves nothing until then", async () => {
    await renderPage();
    await takeNext();
    const save = screen.getByRole("button", { name: copy.save });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(copy.blockers.notCalled)).toBeInTheDocument();
    fireEvent.click(save);
    expect(actions.closeCallListItemAction).not.toHaveBeenCalled();
  });

  it("records the outcome and a note after the call ends", async () => {
    const view = await renderPage();
    await takeNext();
    fireEvent.click(screen.getByRole("button", { name: copy.call.call }));

    act(() => withCall(callFor("answered", { callId: "call-1", answeredAt: Date.now() })));
    view.rerender(<CallListWorkerPage listId="list-1" />);
    expect(await screen.findByText(copy.blockers.callLive)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: pt.calling.dialer.hangUp })).toBeInTheDocument();

    stampedByTheServer();
    act(() => withCall(callFor("ended", { callId: "call-1", reason: "completed", durationSeconds: 134 })));
    view.rerender(<CallListWorkerPage listId="list-1" />);
    act(() => withCall(null));
    view.rerender(<CallListWorkerPage listId="list-1" />);
    expect(await screen.findByText(/^Chamada encerrada/)).toBeInTheDocument();
    expect(screen.getByText("02:14")).toBeInTheDocument();
    expect(await screen.findByText(copy.blockers.noOutcome)).toBeInTheDocument();

    const outcomes = screen.getByRole("radiogroup", { name: copy.outcome.title });
    fireEvent.click(within(outcomes).getByRole("radio", { name: "Interessada" }));
    fireEvent.change(screen.getByLabelText(copy.outcome.note), { target: { value: "Vai visitar no sábado" } });
    actions.nextCallListItemAction.mockResolvedValueOnce({ data: aNext({ item: undefined, lead: undefined, lastInteraction: undefined }), error: null });
    fireEvent.click(screen.getByRole("button", { name: copy.save }));

    await waitFor(() => expect(actions.closeCallListItemAction).toHaveBeenCalledWith("item-1", { disposition: "interessada", note: "Vai visitar no sábado" }));
    expect(await screen.findByText(copy.next.empty)).toBeInTheDocument();
    expect(actions.nextCallListItemAction).toHaveBeenCalledTimes(2);
  });

  it("needs a time to call back and sends it with the callback outcome", async () => {
    const view = await renderPage();
    await takeNext();
    await callAndEnd(view);
    await screen.findByText(copy.blockers.noOutcome);
    fireEvent.click(screen.getByRole("radio", { name: copy.outcome.callback }));
    expect(screen.getByText(copy.blockers.callbackTime)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(copy.outcome.callbackAt), { target: { value: "2031-10-09T15:00" } });
    fireEvent.click(screen.getByRole("button", { name: copy.save }));
    await waitFor(() => expect(actions.closeCallListItemAction).toHaveBeenCalled());
    expect(actions.closeCallListItemAction.mock.calls[0][1]).toEqual({ disposition: "_callback", callbackAt: new Date(2031, 9, 9, 15, 0).toISOString() });
  });

  it("keeps the contact reserved when the call never starts, and releases it on request", async () => {
    const view = await renderPage();
    await takeNext();
    fireEvent.click(screen.getByRole("button", { name: copy.call.call }));
    act(() => withCall(callFor("ringing")));
    view.rerender(<CallListWorkerPage listId="list-1" />);
    act(() => withCall(null, "trunk_unavailable"));
    view.rerender(<CallListWorkerPage listId="list-1" />);

    expect(await screen.findByText(copy.call.notStarted)).toBeInTheDocument();
    expect(screen.getByText(copy.blockers.notCalled)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.call.again })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: copy.release }));
    await waitFor(() => expect(actions.releaseCallListItemAction).toHaveBeenCalledWith("item-1"));
    expect(await screen.findByRole("button", { name: copy.next.start })).toBeInTheDocument();
  });

  it("says why the call never started when the microphone refused it", async () => {
    const view = await renderPage();
    await takeNext();
    fireEvent.click(screen.getByRole("button", { name: copy.call.call }));
    act(() => withCall(callFor("ringing")));
    view.rerender(<CallListWorkerPage listId="list-1" />);
    act(() => withCall(null, "microphone_denied"));
    view.rerender(<CallListWorkerPage listId="list-1" />);
    expect(await screen.findByText(copy.call.notStarted)).toBeInTheDocument();
    expect(screen.getByText(pt.calling.dialer.errors.microphone_denied)).toBeInTheDocument();
  });

  it("calls through the line the member chose anywhere in the workspace", async () => {
    actions.nextCallListItemAction.mockResolvedValue({ data: aNext({ trunks: [{ id: "t-1", name: "Linha Barueri 1" }, { id: "t-2", name: "Linha Barueri 2" }] }), error: null });
    await renderPage();
    await takeNext();
    act(() => rememberTrunk("ws-1", "t-2"));
    fireEvent.click(screen.getByRole("button", { name: copy.call.call }));
    expect(requests.at(-1)).toMatchObject({ trunkId: "t-2", label: "Linha Barueri 2" });
  });

  it("explains a dropped connection and refreshes the item to find the stamped call", async () => {
    const view = await renderPage();
    await takeNext();
    fireEvent.click(screen.getByRole("button", { name: copy.call.call }));
    act(() => withCall(callFor("answered", { callId: "call-1", answeredAt: Date.now() })));
    view.rerender(<CallListWorkerPage listId="list-1" />);
    expect(screen.getByText(copy.blockers.callLive)).toBeInTheDocument();
    actions.listCallListItemsAction.mockResolvedValue({ data: { items: [anItem({ lastCallId: "call-1", closable: true })] }, error: null });
    act(() => withCall(callFor("ended", { callId: "call-1", reason: "connection_lost" })));
    view.rerender(<CallListWorkerPage listId="list-1" />);

    expect(await screen.findByText(copy.call.lostStamped)).toBeInTheDocument();
    expect(actions.listCallListItemsAction).toHaveBeenCalledWith("list-1", { state: "reserved", limit: 200 });
    expect(actions.nextCallListItemAction).toHaveBeenCalledTimes(1);
    expect(screen.getByText(copy.blockers.noOutcome)).toBeInTheDocument();
  });

  it("serves a callback stamped by an earlier call as a contact to call again, and saves nothing before that call", async () => {
    actions.nextCallListItemAction.mockResolvedValue({
      data: aNext({ item: anItem({ lastCallId: "call-0", disposition: "_callback", callbackAt: "2026-10-08T10:00:00Z" }) }),
      error: null,
    });
    const view = await renderPage();
    await takeNext();
    expect(screen.getByRole("button", { name: copy.call.again })).toBeInTheDocument();
    const save = screen.getByRole("button", { name: copy.save });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(copy.blockers.notCalled)).toBeInTheDocument();
    fireEvent.click(within(await screen.findByRole("radiogroup", { name: copy.outcome.title })).getByRole("radio", { name: "Interessada" }));
    fireEvent.click(save);
    expect(actions.closeCallListItemAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: copy.call.again }));
    expect(requests.at(-1)).toMatchObject({ callListItemId: "item-1", phoneNumber: "5511900010142" });
    act(() => withCall(callFor("answered", { callId: "call-1", answeredAt: Date.now() })));
    view.rerender(<CallListWorkerPage listId="list-1" />);
    stampedByTheServer();
    act(() => withCall(callFor("ended", { callId: "call-1", reason: "no_answer" })));
    view.rerender(<CallListWorkerPage listId="list-1" />);
    expect(await screen.findByRole("button", { name: copy.call.again })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: copy.save })).toHaveAttribute("aria-disabled", "false"));
  });

  it("trusts the server: a contact called before but not closable by the member needs a new call", async () => {
    actions.nextCallListItemAction.mockResolvedValue({ data: aNext({ item: anItem({ reservedUntil: minutesFromNow(15), lastCallId: "rec-rafael", closable: false }) }), error: null });
    await renderPage();
    await takeNext();
    expect(screen.getByRole("button", { name: copy.call.again })).toBeInTheDocument();
    expect(screen.queryByText(copy.call.stamped)).not.toBeInTheDocument();
    const save = screen.getByRole("button", { name: copy.save });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(copy.blockers.notCalled)).toBeInTheDocument();
    fireEvent.click(within(await screen.findByRole("radiogroup", { name: copy.outcome.title })).getByRole("radio", { name: "Interessada" }));
    fireEvent.click(save);
    expect(actions.closeCallListItemAction).not.toHaveBeenCalled();
  });

  it("lets the member record the outcome of a contact already called after the page opens again, without a second call", async () => {
    actions.listCallListItemsAction.mockImplementation(async (_listId: string, query: { state?: string; limit?: number }) => ({
      data: { items: query.state === "reserved" && query.limit === 200 ? [anItem({ reservedUntil: minutesFromNow(5) })] : [] },
      error: null,
    }));
    actions.nextCallListItemAction.mockResolvedValue({ data: aNext({ item: anItem({ reservedUntil: minutesFromNow(15), lastCallId: "rec-me", closable: true }) }), error: null });
    await renderPage();
    expect(await screen.findByText(copy.call.stamped)).toBeInTheDocument();
    fireEvent.click(within(await screen.findByRole("radiogroup", { name: copy.outcome.title })).getByRole("radio", { name: "Interessada" }));
    expect(screen.getByRole("button", { name: copy.save })).toHaveAttribute("aria-disabled", "false");
    fireEvent.click(screen.getByRole("button", { name: copy.save }));
    await waitFor(() => expect(actions.closeCallListItemAction).toHaveBeenCalledWith("item-1", { disposition: "interessada" }));
    expect(requests).toEqual([]);
  });

  it("shows a held contact whose reservation expired only when the server still lets the member close it", async () => {
    actions.getCallListAction.mockResolvedValue({ data: aList({ status: "paused", statusMoves: ["active", "archived"] }), error: null });
    actions.listCallListItemsAction.mockImplementation(async (_listId: string, query: { state?: string; limit?: number }) => ({
      data: { items: query.state === "reserved" && query.limit === 200 ? [anItem({ reservedUntil: minutesFromNow(-5) })] : [] },
      error: null,
    }));
    await renderPage();
    await waitFor(() => expect(actions.listCallListItemsAction).toHaveBeenCalledWith("list-1", { state: "reserved", limit: 200 }));
    expect(screen.queryByText("Maria Aparecida Souza")).not.toBeInTheDocument();
  });

  it("keeps following its own call when the server echoes the number with the ninth digit added", async () => {
    actions.nextCallListItemAction.mockResolvedValue({ data: aNext({ item: anItem({ phone: "551187654321" }) }), error: null });
    const view = await renderPage();
    await takeNext();
    fireEvent.click(screen.getByRole("button", { name: copy.call.call }));
    act(() => withCall(callFor("answered", { phoneNumber: "5511987654321", callId: "call-1", answeredAt: Date.now() })));
    view.rerender(<CallListWorkerPage listId="list-1" />);
    expect(await screen.findByText(copy.blockers.callLive)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: pt.calling.dialer.hangUp })).toHaveLength(1);

    stampedByTheServer();
    act(() => withCall(callFor("ended", { phoneNumber: "5511987654321", callId: "call-1", reason: "completed" })));
    view.rerender(<CallListWorkerPage listId="list-1" />);
    expect(await screen.findByText(/^Chamada encerrada/)).toBeInTheDocument();
    expect(await screen.findByText(copy.blockers.noOutcome)).toBeInTheDocument();
  });

  it("blocks saving while any call is live, even one that belongs to no item", async () => {
    const view = await renderPage();
    await takeNext();
    await callAndEnd(view);
    await screen.findByText(copy.blockers.noOutcome);
    fireEvent.click(within(await screen.findByRole("radiogroup", { name: copy.outcome.title })).getByRole("radio", { name: "Interessada" }));
    act(() => withCall({ phoneNumber: "5584994409684", status: "answered", channel: "whatsapp", callId: "wa-in-1", requestId: "someone-else", answeredAt: Date.now() }));
    view.rerender(<CallListWorkerPage listId="list-1" />);
    expect(await screen.findByText(copy.blockers.callLive)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.save }));
    expect(actions.closeCallListItemAction).not.toHaveBeenCalled();
  });

  it("lets the member record the outcome of a held contact after the list is paused, without serving more", async () => {
    actions.getCallListAction.mockResolvedValue({ data: aList({ status: "paused", statusMoves: ["active", "archived"] }), error: null });
    actions.listCallListItemsAction.mockImplementation(async (_listId: string, query: { state?: string; limit?: number }) => ({
      data: { items: query.state === "reserved" && query.limit === 200 ? [anItem({ lastCallId: "call-1", closable: true })] : [] },
      error: null,
    }));
    await renderPage();
    expect(await screen.findByText("Maria Aparecida Souza")).toBeInTheDocument();
    expect(screen.getByText(copy.worker.paused)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.call.call })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.call.again })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.next.start })).not.toBeInTheDocument();
    await waitFor(() => expect(callSurfaceOwner()).toBe("call_list"));

    fireEvent.click(within(await screen.findByRole("radiogroup", { name: copy.outcome.title })).getByRole("radio", { name: "Interessada" }));
    fireEvent.click(screen.getByRole("button", { name: copy.saveOnly }));
    await waitFor(() => expect(actions.closeCallListItemAction).toHaveBeenCalledWith("item-1", { disposition: "interessada" }));
    expect(actions.nextCallListItemAction).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Maria Aparecida Souza")).not.toBeInTheDocument());
  });

  it("keeps a paused list read-only for a member who holds nothing", async () => {
    actions.getCallListAction.mockResolvedValue({ data: aList({ status: "paused" }), error: null });
    await renderPage();
    await waitFor(() => expect(actions.listCallListItemsAction).toHaveBeenCalledWith("list-1", { state: "reserved", limit: 200 }));
    expect(screen.queryByRole("heading", { name: copy.next.title })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.next.start })).not.toBeInTheDocument();
    expect(callSurfaceOwner()).toBeNull();
  });

  it("shows why the held contact could not be looked up when the page opens", async () => {
    actions.listCallListItemsAction.mockResolvedValue({ data: null, error: { code: "call_lists_unavailable", status: 503, message: "x" } });
    await renderPage();
    expect(await screen.findByText(copy.errors.call_lists_unavailable, { selector: "[role=alert]" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.next.start })).not.toBeDisabled();
  });

  it("keeps a call that is not the item's on screen while the page owns the call surface", async () => {
    connected({ callState: { phoneNumber: "5584994409684", status: "answered", channel: "whatsapp", callId: "wa-in-1", answeredAt: Date.now() } });
    await renderPage();
    await waitFor(() => expect(callSurfaceOwner()).toBe("call_list"));
    expect(await screen.findByRole("button", { name: pt.calling.dialer.hangUp })).toBeInTheDocument();
  });

  it("picks up the contact the member already holds when the page opens", async () => {
    actions.listCallListItemsAction.mockImplementation(async (_listId: string, query: { state?: string; limit?: number }) => ({
      data: { items: query.state === "reserved" && query.limit === 200 ? [anItem({ reservedBy: "u-rafael", id: "other" }), anItem()] : [] },
      error: null,
    }));
    await renderPage();
    expect(await screen.findByText("Jardim Silveira · Barueri")).toBeInTheDocument();
    expect(actions.listCallListItemsAction).toHaveBeenCalledWith("list-1", { state: "reserved", limit: 200 });
    expect(actions.nextCallListItemAction).toHaveBeenCalledTimes(1);
  });

  it("says when the queue is empty and when the server stopped before its end", async () => {
    actions.nextCallListItemAction.mockResolvedValue({ data: aNext({ item: undefined, lead: undefined, lastInteraction: undefined, refused: 25, more: true }), error: null });
    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: copy.next.start }));
    expect(await screen.findByText(copy.next.more)).toBeInTheDocument();
    expect(screen.getByText("25 contatos pulados porque o lead não pode mais receber ligações agora.")).toBeInTheDocument();
  });

  it("does not offer work to a member who is not among the callers", async () => {
    actions.getCallListAction.mockResolvedValue({ data: aList({ assigneeIds: ["u-rafael"] }), error: null });
    await renderPage();
    expect(await screen.findByText(copy.worker.notAssignee)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.next.start })).not.toBeInTheDocument();
    expect(callSurfaceOwner()).toBeNull();
  });

  it("tells that a list is still being built", async () => {
    actions.getCallListAction.mockResolvedValue({ data: aList({ status: "building", itemCount: 0, closedCount: 0, openCount: 0 }), error: null });
    await renderPage();
    expect(screen.getByText(/^Montando a lista: conferindo os 1\.300 leads/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.next.start })).not.toBeInTheDocument();
  });

  it("lets a manager change who calls and offers only the status moves the server allows", async () => {
    granted.value = new Set(MANAGER);
    actions.getCallListAction.mockResolvedValue({ data: aList({ statusMoves: ["archived"] }), error: null });
    await renderPage();
    expect(screen.getByRole("button", { name: "Quem liga (2)" })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("button", { name: copy.actions.menu.replace("{name}", aList().name) }), { button: 0, ctrlKey: false, pointerType: "mouse" });
    expect(await screen.findByRole("menuitem", { name: copy.actions.archive })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: copy.actions.pause })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Aprovar/ })).not.toBeInTheDocument();
  });

  it("keeps the assignees button off a list the server says takes no outcomes", async () => {
    granted.value = new Set(MANAGER);
    actions.getCallListAction.mockResolvedValue({ data: aList({ status: "archived", acceptsOutcomes: false, statusMoves: ["active"] }), error: null });
    await renderPage();
    expect(screen.queryByRole("button", { name: "Quem liga (2)" })).not.toBeInTheDocument();
  });

  it("shows the last interaction as plain text when there is no conversation to open", async () => {
    actions.nextCallListItemAction.mockResolvedValue({ data: aNext({ lastInteraction: undefined }), error: null });
    await renderPage();
    await takeNext();
    expect(screen.getByText(copy.next.noInteraction)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Conversa em / })).not.toBeInTheDocument();
  });

  it("reads the list missing as not found", async () => {
    actions.getCallListAction.mockResolvedValue({ data: null, error: { code: "call_list_not_found", status: 404, message: "x" } });
    renderWithProviders(<CallListWorkerPage listId="list-1" />);
    expect(await screen.findByText(copy.worker.notFound)).toBeInTheDocument();
  });
});
