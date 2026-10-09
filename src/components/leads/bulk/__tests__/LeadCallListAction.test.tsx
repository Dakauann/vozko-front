import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import ptMessages from "@/i18n/messages/pt.json";

const previewLeadActionAction = vi.fn();
const startLeadActionAction = vi.fn();
const fetchDialTargets = vi.fn();
const permissions = vi.hoisted(() => ({ granted: new Set<string>() }));

vi.mock("@/app/actions/lead-actions", () => ({
  previewLeadActionAction: (...args: unknown[]) => previewLeadActionAction(...args),
  getLeadActionPreviewAction: vi.fn(),
  startLeadActionAction: (...args: unknown[]) => startLeadActionAction(...args),
  getLeadActionRunAction: vi.fn(),
  getLeadAudienceAction: vi.fn(),
}));
vi.mock("@/app/actions/leads", () => ({ fetchLeadSection: vi.fn() }));
vi.mock("@/app/actions/sip-trunks", () => ({ fetchDialTargets: (...args: unknown[]) => fetchDialTargets(...args) }));
vi.mock("@/contexts/call-session-context", () => ({ useCallSession: () => ({ status: "connected", callState: null }) }));
vi.mock("@/app/actions/advertising", () => ({ listAdAccountsAction: vi.fn(() => Promise.resolve({ data: [] })), isAdsError: () => false }));
vi.mock("@/app/actions/reports", () => ({ createReportAction: vi.fn(), getReportAction: vi.fn(), fetchReportFileAction: vi.fn() }));
vi.mock("@/app/actions/workspace", () => ({
  listAssignableMembersAction: () =>
    Promise.resolve({
      members: [
        { userId: "u-clara", username: "Clara", email: "clara@x.com" },
        { userId: "u-rafael", username: "Rafael", email: "rafael@x.com" },
      ],
      page: 1,
      pageSize: 200,
      totalPages: 1,
      totalItems: 2,
    }),
}));
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/contexts/workspace-context", async () => {
  const { LEAD_CATALOG } = await import("./lead-catalog");
  return {
    useWorkspace: () => {
      const permissionsMap: Record<string, Set<string>> = {};
      for (const entry of permissions.granted) {
        const [resource, action] = entry.split(":");
        (permissionsMap[resource] ??= new Set()).add(action);
      }
      return {
        currentWorkspace: { id: "ws-1" },
        can: (resource: string, action: string) => permissions.granted.has(`${resource}:${action}`),
        featureCatalog: { status: "ready", features: LEAD_CATALOG },
        permissionCatalog: [],
        permissionsLoading: false,
        permissionsMap,
        privileged: false,
        systemAdmin: false,
      };
    },
  };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), message: vi.fn() } }));

import { DashboardTable } from "@/components/elevated-design/table/dashboard-table";
import type { CrmFilter } from "@/lib/crm/board";

import { useLeadBulk } from "../use-lead-bulk";

const BAIRRO: CrmFilter = {
  groups: [{ conjunction: "and", predicates: [{ field: "district", operator: "in", values: ["barueri|centro"] }] }],
};

const MANAGER = ["leads:read", "call_lists:read", "call_lists:manage", "members:read"];

const bulk = ptMessages.leadsPage.bulk;
const fields = bulk.dialog.callList;

const callList = {
  id: "list-1",
  name: "Rematrícula",
  status: "building",
  createdBy: "u-me",
  assigneeIds: ["u-clara"],
  phone: { source: "identity" },
  selected: 2,
  itemCount: 0,
  closedCount: 0,
  openCount: 0,
  skipped: {},
  createdAt: "2026-10-08T12:00:00Z",
  updatedAt: "2026-10-08T12:00:00Z",
};

function preview(count: number) {
  return {
    data: {
      id: `p-${count}`,
      action: "call_list",
      status: "done",
      result: { matched: count, expectedCount: count, fingerprint: "fp", selected: count, eligible: count, skipped: {} },
    },
    error: null,
  };
}

function Harness({ rows }: { rows: string[] }) {
  const lead = useLeadBulk({ filter: BAIRRO, search: "", sorts: [], filterInvalid: false, fields: [], onSettled: vi.fn() });
  return (
    <>
      <DashboardTable<{ id: string }>
        data={rows.map((id) => ({ id }))}
        columns={[{ key: "id", header: "Lead", render: (row) => row.id }]}
        rowKey={(row) => row.id}
        selection={lead.tableSelection(rows, rows.length)}
      />
      {lead.dialog}
    </>
  );
}

function renderHarness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <Harness rows={["l-1", "l-2"]} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

async function openCallList() {
  fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
  fireEvent.click(screen.getByRole("button", { name: bulk.actions.call_list }));
  return screen.findByRole("dialog");
}

async function addMember(dialog: HTMLElement, name: string) {
  fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(`^${ptMessages.callLists.assignees.add}`) }));
  fireEvent.click(await screen.findByRole("option", { name }));
}

describe("creating a call list from a lead selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.granted = new Set(MANAGER);
    previewLeadActionAction.mockResolvedValue(preview(2));
  });

  it("is refused to whoever cannot manage call lists, with the reason", () => {
    permissions.granted = new Set(["leads:read"]);
    renderHarness();
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    const button = screen.getByRole("button", { name: new RegExp(bulk.actions.call_list) });
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveTextContent(bulk.blockers.permissionCallList);
  });

  it("is refused, with the reason, when the workspace has no line to call through", async () => {
    permissions.granted = new Set([...MANAGER, "sip_trunks:call", "call_session:use"]);
    fetchDialTargets.mockResolvedValue({ numbers: [], trunks: [] });
    renderHarness();
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    expect(await screen.findByRole("button", { name: `${bulk.actions.call_list}. ${bulk.blockers.noDialableLine}` })).toBeDisabled();
    expect(fetchDialTargets).toHaveBeenCalledWith(null, expect.anything());
  });

  it("stays open when a line exists, or when the builder cannot call and only builds the list", async () => {
    permissions.granted = new Set([...MANAGER, "sip_trunks:call", "call_session:use"]);
    fetchDialTargets.mockResolvedValue({ numbers: [], trunks: [{ id: "t1", name: "Matriz" }] });
    const view = renderHarness();
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    await waitFor(() => expect(fetchDialTargets).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: bulk.actions.call_list })).toBeEnabled();
    view.unmount();

    permissions.granted = new Set(MANAGER);
    fetchDialTargets.mockClear();
    renderHarness();
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    expect(screen.getByRole("button", { name: bulk.actions.call_list })).toBeEnabled();
    expect(fetchDialTargets).not.toHaveBeenCalled();
  });

  it("proposes a name, waits for someone to call, previews and creates the list", async () => {
    const { toast } = await import("sonner");
    startLeadActionAction.mockResolvedValue({ data: { action: "call_list", callList }, error: null });
    renderHarness();
    const dialog = await openCallList();

    const name = within(dialog).getByLabelText(fields.name) as HTMLInputElement;
    expect(name.value).toMatch(/^Lista de /);
    const create = within(dialog).getByRole("button", { name: bulk.dialog.apply.call_list });
    expect(create).toBeDisabled();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(previewLeadActionAction).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: "Rematrícula" } });
    await addMember(dialog, "Clara");
    await waitFor(() => expect(previewLeadActionAction).toHaveBeenCalled());
    expect(previewLeadActionAction.mock.calls.at(-1)?.[0]).toMatchObject({
      action: "call_list",
      params: { callList: { name: "Rematrícula", assigneeIds: ["u-clara"], phoneSource: "identity" } },
      selection: { mode: "ids", ids: ["l-1", "l-2"] },
    });
    expect(within(dialog).getByText(bulk.dialog.counts.eligible.call_list)).toBeInTheDocument();

    await waitFor(() => expect(create).toBeEnabled());
    fireEvent.click(create);
    await waitFor(() => expect(startLeadActionAction).toHaveBeenCalled());
    expect(startLeadActionAction.mock.calls[0][0].params.callList).toEqual({ name: "Rematrícula", assigneeIds: ["u-clara"], phoneSource: "identity" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(bulk.callListQueued, expect.objectContaining({ action: expect.anything() })));
  });

  it("asks which contact phone to call when the list does not use the WhatsApp", async () => {
    renderHarness();
    const dialog = await openCallList();
    await addMember(dialog, "Clara");
    await waitFor(() => expect(previewLeadActionAction).toHaveBeenCalledTimes(1));

    fireEvent.click(within(dialog).getByRole("button", { name: fields.contact }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(previewLeadActionAction).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole("combobox", { name: fields.label }));
    fireEvent.click(await screen.findByRole("option", { name: ptMessages.leadSheet.phones.labels.landline }));
    await waitFor(() => expect(previewLeadActionAction).toHaveBeenCalledTimes(2));
    expect(previewLeadActionAction.mock.calls[1][0].params.callList).toMatchObject({ phoneSource: "contact", phoneLabel: "landline" });
  });

  it("asks for no sign-off and sends none", async () => {
    renderHarness();
    const dialog = await openCallList();
    await addMember(dialog, "Clara");
    await waitFor(() => expect(previewLeadActionAction).toHaveBeenCalled());
    expect(within(dialog).queryByText(/aprova/i)).toBeNull();
    expect(previewLeadActionAction.mock.calls.at(-1)?.[0].params.callList).not.toHaveProperty("signOff");
  });

  it("shows the server's refusal of a member in the member's language", async () => {
    previewLeadActionAction.mockResolvedValue({ data: null, error: { code: "call_list_assignee_cannot_work", status: 422, message: "x" } });
    renderHarness();
    const dialog = await openCallList();
    await addMember(dialog, "Rafael");
    expect(await within(dialog).findByText(ptMessages.callLists.errors.call_list_assignee_cannot_work)).toBeInTheDocument();
  });
});
