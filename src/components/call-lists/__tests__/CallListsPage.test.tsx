import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";

import { aList, MANAGER, MEMBERS, renderWithProviders, WORKER, workspaceFor } from "./call-list-test-kit";

const granted = vi.hoisted(() => ({ value: new Set<string>() }));
const actions = vi.hoisted(() => ({
  listCallListsAction: vi.fn(),
  getCallListAction: vi.fn(),
  updateCallListAction: vi.fn(),
  deleteCallListAction: vi.fn(),
  listCallListItemsAction: vi.fn(),
  nextCallListItemAction: vi.fn(),
  releaseCallListItemAction: vi.fn(),
  closeCallListItemAction: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => workspaceFor(granted.value) }));
vi.mock("@/app/actions/call-lists", () => actions);
vi.mock("@/app/actions/workspace", () => ({ listAssignableMembersAction: () => Promise.resolve(MEMBERS) }));
vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dashboard/call-lists",
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn(), warning: vi.fn() } }));

import { CallListsPage } from "../CallListsPage";

const copy = pt.callLists;

function page(items = [aList(), aList({ id: "list-2", name: "Retorno", status: "building", assigneeIds: ["u-rafael"], selected: 400, itemCount: 0, closedCount: 0, openCount: 0 })]) {
  return { data: { items, total: items.length, page: 1, pageSize: 20 }, error: null };
}

describe("CallListsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    granted.value = new Set(WORKER);
    actions.listCallListsAction.mockResolvedValue(page());
  });

  it("lists each call list with who calls, its progress and its status", async () => {
    renderWithProviders(<CallListsPage />);
    expect(await screen.findByText("Rematrícula Jardim Silveira")).toBeInTheDocument();
    expect(actions.listCallListsAction).toHaveBeenCalledWith({ page: 1, pageSize: 20, status: undefined }, expect.any(AbortSignal));
    expect(screen.getByText("392 de 1.204 encerrados")).toBeInTheDocument();
    expect(screen.getByText("Conferindo 400 leads")).toBeInTheDocument();
    expect(screen.getByText(copy.status.active)).toBeInTheDocument();
    expect(screen.getByText(copy.status.building)).toBeInTheDocument();
    expect(await screen.findByText("Clara Mendes, Rafael Torres")).toBeInTheDocument();
    expect(screen.getAllByText(copy.phone.identity)).toHaveLength(2);
  });

  it("opens the worker page of a list", async () => {
    renderWithProviders(<CallListsPage />);
    fireEvent.click(await screen.findByText("Rematrícula Jardim Silveira"));
    expect(push).toHaveBeenCalledWith("/dashboard/call-lists/list-1");
  });

  it("filters by status on the server", async () => {
    renderWithProviders(<CallListsPage />);
    await screen.findByText("Rematrícula Jardim Silveira");
    fireEvent.click(screen.getByRole("combobox", { name: copy.filters.status }));
    fireEvent.click(await screen.findByRole("option", { name: copy.status.paused }));
    await waitFor(() => expect(actions.listCallListsAction).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, status: "paused" }, expect.any(AbortSignal)));
  });

  it("offers list actions only to managers", async () => {
    renderWithProviders(<CallListsPage />);
    await screen.findByText("Rematrícula Jardim Silveira");
    expect(screen.queryByRole("button", { name: /^Ações da lista/ })).not.toBeInTheDocument();
  });

  it("pauses and deletes a list for a manager", async () => {
    granted.value = new Set(MANAGER);
    actions.updateCallListAction.mockResolvedValue({ data: aList({ status: "paused" }), error: null });
    actions.deleteCallListAction.mockResolvedValue({ data: true, error: null });
    renderWithProviders(<CallListsPage />);
    const trigger = await screen.findByRole("button", { name: "Ações da lista Rematrícula Jardim Silveira" });

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(await screen.findByRole("menuitem", { name: copy.actions.pause }));
    await waitFor(() => expect(actions.updateCallListAction).toHaveBeenCalledWith("list-1", { status: "paused" }));
    expect(push).not.toHaveBeenCalled();

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(await screen.findByRole("menuitem", { name: copy.actions.delete }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: copy.confirm.deleteConfirm }));
    await waitFor(() => expect(actions.deleteCallListAction).toHaveBeenCalledWith("list-1"));
    expect(push).not.toHaveBeenCalled();
  });

  it("points to Leads when there is no list yet", async () => {
    actions.listCallListsAction.mockResolvedValue(page([]));
    renderWithProviders(<CallListsPage />);
    expect(await screen.findByText(copy.page.emptyTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.page.goToLeads }));
    expect(push).toHaveBeenCalledWith("/dashboard/leads");
  });

  it("shows why the lists could not load and retries", async () => {
    actions.listCallListsAction.mockResolvedValue({ data: null, error: { code: "call_lists_unavailable", status: 503, message: "x" } });
    renderWithProviders(<CallListsPage />);
    expect(await screen.findByText(copy.errors.call_lists_unavailable, {}, { timeout: 20_000 })).toBeInTheDocument();
    actions.listCallListsAction.mockResolvedValue(page());
    fireEvent.click(screen.getByRole("button", { name: copy.page.retry }));
    expect(await screen.findByText("Rematrícula Jardim Silveira")).toBeInTheDocument();
  });
});
