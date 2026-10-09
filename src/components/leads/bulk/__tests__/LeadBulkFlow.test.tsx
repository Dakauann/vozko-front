import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import ptMessages from "@/i18n/messages/pt.json";

const previewLeadActionAction = vi.fn();
const getLeadActionPreviewAction = vi.fn();
const startLeadActionAction = vi.fn();
const getLeadActionRunAction = vi.fn();
const getLeadAudienceAction = vi.fn();
const fetchLeadSection = vi.fn();
const getReportAction = vi.fn();
const fetchReportFileAction = vi.fn();
const downloadBlob = vi.fn();
const listAdAccountsAction = vi.fn();
const listBusinessPhonesAction = vi.fn();
const listInstancesAction = vi.fn();
const fetchDialTargets = vi.fn();
const permissions = vi.hoisted(() => ({ granted: new Set<string>() }));
const bulkListeners = vi.hoisted(() => new Set<(event: { runId: string }) => void>());

vi.mock("@/contexts/crm-context", () => ({
  useOptionalCrm: () => ({
    subscribeLeadsBulkUpdates: (listener: (event: { runId: string }) => void) => {
      bulkListeners.add(listener);
      return () => void bulkListeners.delete(listener);
    },
  }),
}));

vi.mock("@/app/actions/lead-actions", () => ({
  previewLeadActionAction: (...args: unknown[]) => previewLeadActionAction(...args),
  getLeadActionPreviewAction: (...args: unknown[]) => getLeadActionPreviewAction(...args),
  startLeadActionAction: (...args: unknown[]) => startLeadActionAction(...args),
  getLeadActionRunAction: (...args: unknown[]) => getLeadActionRunAction(...args),
  getLeadAudienceAction: (...args: unknown[]) => getLeadAudienceAction(...args),
}));
vi.mock("@/app/actions/leads", () => ({ fetchLeadSection: (...args: unknown[]) => fetchLeadSection(...args) }));
vi.mock("@/app/actions/whatsapp-business-phones", () => ({
  listBusinessPhonesAction: (...args: unknown[]) => listBusinessPhonesAction(...args),
}));
vi.mock("@/app/actions/unofficial-whatsapp", () => ({ listInstancesAction: (...args: unknown[]) => listInstancesAction(...args) }));
vi.mock("@/app/actions/sip-trunks", () => ({ fetchDialTargets: (...args: unknown[]) => fetchDialTargets(...args) }));
vi.mock("@/contexts/call-session-context", () => ({ useCallSession: () => ({ status: "connected", callState: null }) }));
vi.mock("@/app/actions/advertising", () => ({
  listAdAccountsAction: (...args: unknown[]) => listAdAccountsAction(...args),
  isAdsError: (result: { error?: string }) => typeof result.error === "string",
}));
vi.mock("@/app/actions/reports", () => ({
  createReportAction: vi.fn(),
  getReportAction: (...args: unknown[]) => getReportAction(...args),
  fetchReportFileAction: (...args: unknown[]) => fetchReportFileAction(...args),
}));
vi.mock("@/lib/browser/download", () => ({ downloadBlob: (...args: unknown[]) => downloadBlob(...args) }));
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
import { effectiveLeadFilter } from "@/lib/leads/bulk-selection";
import { followedJobsKey } from "@/lib/leads/followed-runs";
import type { LeadSort } from "@/lib/leads/types";

import { useLeadBulk } from "../use-lead-bulk";

const ALL_PERMISSIONS = [
  "leads:read",
  "leads:update",
  "leads:bulk_update",
  "leads:assign",
  "leads:block",
  "leads:export",
  "reports:create",
  "reports:read",
  "ads:create",
];

const BAIRRO: CrmFilter = {
  groups: [{ conjunction: "and", predicates: [{ field: "district", operator: "in", values: ["barueri|centro"] }] }],
};

const SORTS: LeadSort[] = [{ key: "lastActivityAt", direction: "desc" }];

function preview(matched: number, fingerprint = "fp-1") {
  return {
    data: {
      id: `p-${matched}-${fingerprint}`,
      action: "export",
      status: "done",
      result: { matched, expectedCount: matched, fingerprint, selected: matched, eligible: matched, skipped: {} },
    },
    error: null,
  };
}

function Harness({ rows, total, filter = BAIRRO, search = "" }: { rows: string[]; total: number; filter?: CrmFilter; search?: string }) {
  const bulk = useLeadBulk({ filter, search, sorts: SORTS, filterInvalid: false, fields: [], onSettled: vi.fn() });
  return (
    <>
      <DashboardTable<{ id: string }>
        data={rows.map((id) => ({ id }))}
        columns={[{ key: "id", header: "Lead", render: (row) => row.id }]}
        rowKey={(row) => row.id}
        selection={bulk.tableSelection(rows, total)}
      />
      {bulk.dialog}
    </>
  );
}

function renderHarness(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (node: ReactNode) => (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        {node}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  const view = render(wrap(ui));
  return { ...view, rerender: (node: ReactNode) => view.rerender(wrap(node)) };
}

const bulk = ptMessages.leadsPage.bulk;

async function openExport() {
  fireEvent.pointerDown(screen.getByRole("button", { name: bulk.more }), { button: 0, ctrlKey: false, pointerType: "mouse" });
  fireEvent.click(await screen.findByRole("menuitem", { name: new RegExp(`^${bulk.actions.export}`) }));
}

describe("lead bulk selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    permissions.granted = new Set(ALL_PERMISSIONS);
    listAdAccountsAction.mockResolvedValue({ data: [] });
    listBusinessPhonesAction.mockResolvedValue({ phones: [{ id: "bp-1" }] });
    listInstancesAction.mockResolvedValue({ instances: [{ id: "in-1" }] });
    fetchDialTargets.mockResolvedValue({ numbers: [], trunks: [{ id: "t1", name: "Matriz" }] });
    previewLeadActionAction.mockResolvedValue(preview(3));
    startLeadActionAction.mockResolvedValue({
      data: { action: "export", report: { id: "job-1", status: "queued", kind: "leads" } },
      error: null,
    });
  });

  it("keeps picks from page one when page two is picked, and sends both as ids", async () => {
    const { rerender } = renderHarness(<Harness rows={["l-1", "l-2"]} total={4} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    rerender(<Harness rows={["l-3", "l-4"]} total={4} />);
    expect(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage })).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getAllByRole("checkbox", { name: ptMessages.leadsPage.selection.selectRow })[0]);
    expect(screen.getByText("3 selecionados")).toBeInTheDocument();

    await openExport();

    await waitFor(() => expect(previewLeadActionAction).toHaveBeenCalled());
    expect(previewLeadActionAction.mock.calls[0][0]).toEqual({
      action: "export",
      params: { format: "csv", addresses: false, sensitive: false },
      selection: { mode: "ids", ids: ["l-1", "l-2", "l-3"] },
    });
  });

  it("selects every lead of the effective filter and confirms with the previewed count and fingerprint", async () => {
    previewLeadActionAction.mockResolvedValue(preview(1204));
    renderHarness(<Harness rows={["l-1", "l-2"]} total={1204} search="maria" />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todos os 1.204 do filtro" }));
    expect(screen.getByText("Todos os 1.204 leads do filtro selecionados")).toBeInTheDocument();

    await openExport();
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(bulk.dialog.counts.eligible.export);
    expect(previewLeadActionAction.mock.calls[0][0].selection).toEqual({
      mode: "all_matching",
      filter: effectiveLeadFilter(BAIRRO, "maria"),
    });

    fireEvent.click(within(dialog).getByRole("button", { name: bulk.dialog.apply.export }));

    await waitFor(() => expect(startLeadActionAction).toHaveBeenCalled());
    const [request, key] = startLeadActionAction.mock.calls[0];
    expect(request.selection).toEqual({
      mode: "all_matching",
      filter: effectiveLeadFilter(BAIRRO, "maria"),
      expectedCount: 1204,
      fingerprint: "fp-1",
    });
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  it("previews again and asks once more when the selection changed since the count", async () => {
    previewLeadActionAction.mockResolvedValueOnce(preview(1204)).mockResolvedValueOnce(preview(1210, "fp-2"));
    startLeadActionAction
      .mockResolvedValueOnce({ data: null, error: { code: "selection_changed", status: 409 } })
      .mockResolvedValueOnce({ data: { action: "export", report: { id: "job-1", status: "queued", kind: "leads" } }, error: null });
    renderHarness(<Harness rows={["l-1", "l-2"]} total={1204} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todos os 1.204 do filtro" }));

    await openExport();
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(bulk.dialog.counts.eligible.export);
    fireEvent.click(within(dialog).getByRole("button", { name: bulk.dialog.apply.export }));

    expect(
      await within(dialog).findByText(
        "A seleção mudou desde a contagem: eram 1.204, agora são 1.210. Confira e confirme de novo.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: bulk.dialog.apply.export }));

    await waitFor(() => expect(startLeadActionAction).toHaveBeenCalledTimes(2));
    expect(startLeadActionAction.mock.calls[1][0].selection).toMatchObject({ expectedCount: 1210, fingerprint: "fp-2" });
    expect(startLeadActionAction.mock.calls[1][1]).not.toBe(startLeadActionAction.mock.calls[0][1]);
  });

  it("asks for the typed total before acting on every lead of the workspace", async () => {
    previewLeadActionAction.mockResolvedValue(preview(7942, "fp-all"));
    renderHarness(<Harness rows={["l-1", "l-2"]} total={7942} filter={{ groups: [] }} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todos os 7.942 leads do workspace" }));

    await openExport();
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(bulk.dialog.counts.eligible.export);
    expect(previewLeadActionAction.mock.calls[0][0].selection).toEqual({ mode: "everyone" });
    const apply = within(dialog).getByRole("button", { name: bulk.dialog.apply.export });
    expect(apply).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Digite 7.942 para confirmar"), { target: { value: "7942" } });
    expect(apply).toBeEnabled();
    fireEvent.click(apply);

    await waitFor(() => expect(startLeadActionAction).toHaveBeenCalled());
    expect(startLeadActionAction.mock.calls[0][0].selection).toEqual({ mode: "everyone", expectedCount: 7942, fingerprint: "fp-all" });
  });

  it("shows the server refusal of a preview in its own words", async () => {
    previewLeadActionAction.mockResolvedValue({ data: null, error: { code: "lead_action_selection_too_large", status: 413 } });
    renderHarness(<Harness rows={["l-1"]} total={1} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    await openExport();
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(bulk.errors.lead_action_selection_too_large)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: bulk.dialog.apply.export })).toBeDisabled();
  });

  it("clears the selection when a block run starts, then follows it until it ends and reloads the list", async () => {
    const { toast } = await import("sonner");
    const onSettled = vi.fn();
    const run = { id: "r-1", action: "block", status: "queued", result: { matched: 1, selected: 1, processed: 0, changed: 0, skipped: {} } };
    startLeadActionAction.mockResolvedValue({ data: { action: "block", run }, error: null });
    getLeadActionRunAction.mockResolvedValue({
      data: { ...run, status: "done", result: { matched: 1, selected: 1, processed: 1, changed: 1, skipped: {} } },
      error: null,
    });
    function Settling() {
      const lead = useLeadBulk({ filter: BAIRRO, search: "", sorts: SORTS, filterInvalid: false, fields: [], onSettled });
      return (
        <>
          <DashboardTable<{ id: string }>
            data={[{ id: "l-1" }]}
            columns={[{ key: "id", header: "Lead", render: (row) => row.id }]}
            rowKey={(row) => row.id}
            selection={lead.tableSelection(["l-1"], 1)}
          />
          {lead.dialog}
        </>
      );
    }
    renderHarness(<Settling />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    fireEvent.pointerDown(screen.getByRole("button", { name: bulk.more }), { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(await screen.findByRole("menuitem", { name: new RegExp(`^${bulk.actions.block}`) }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(bulk.dialog.counts.eligible.edit);
    expect(previewLeadActionAction.mock.calls[0][0]).toMatchObject({ action: "block", params: { blocked: true } });
    fireEvent.click(within(dialog).getByRole("button", { name: bulk.dialog.apply.block }));

    await waitFor(() => expect(screen.queryByText("1 selecionado")).not.toBeInTheDocument());
    expect(onSettled).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    expect(screen.getByText("1 selecionado")).toBeInTheDocument();

    await waitFor(() => expect(onSettled).toHaveBeenCalled(), { timeout: 4000 });
    expect(getLeadActionRunAction).toHaveBeenCalledWith("r-1");
    expect(toast.success).toHaveBeenCalledWith("Pronto: 1 lead alterado, 0 pulados.");
    expect(screen.getByText("1 selecionado")).toBeInTheDocument();
  });

  it("remembers a run it follows until the run ends", async () => {
    const run = { id: "r-7", action: "block", status: "queued", result: { matched: 1, selected: 1, processed: 0, changed: 0, skipped: {} } };
    startLeadActionAction.mockResolvedValue({ data: { action: "block", run }, error: null });
    let finish: (value: unknown) => void = () => undefined;
    getLeadActionRunAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderHarness(<Harness rows={["l-1"]} total={1} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    fireEvent.pointerDown(screen.getByRole("button", { name: bulk.more }), { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(await screen.findByRole("menuitem", { name: new RegExp(`^${bulk.actions.block}`) }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(bulk.dialog.counts.eligible.edit);
    fireEvent.click(within(dialog).getByRole("button", { name: bulk.dialog.apply.block }));

    await waitFor(() => expect(window.localStorage.getItem(followedJobsKey("ws-1"))).toContain("r-7"));
    await waitFor(() => expect(getLeadActionRunAction).toHaveBeenCalledWith("r-7"), { timeout: 4000 });
    finish({ data: { ...run, status: "done", result: { ...run.result, processed: 1, changed: 1 } }, error: null });
    await waitFor(() => expect(window.localStorage.getItem(followedJobsKey("ws-1"))).toBeNull());
  });

  it("goes on following a run started before the page was reloaded", async () => {
    const { toast } = await import("sonner");
    const run = { id: "r-9", action: "classify", status: "done", result: { matched: 3, selected: 3, processed: 3, changed: 2, skipped: { unchanged: 1 } } };
    window.localStorage.setItem(followedJobsKey("ws-1"), JSON.stringify([{ id: "r-9", kind: "run", since: Date.now() }]));
    getLeadActionRunAction.mockResolvedValue({ data: run, error: null });
    renderHarness(<Harness rows={["l-1"]} total={1} />);

    expect(toast.message).toHaveBeenCalledWith(bulk.runResumed, expect.anything());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pronto: 2 leads alterados, 1 pulado."), { timeout: 4000 });
    expect(getLeadActionRunAction).toHaveBeenCalledWith("r-9");
    expect(window.localStorage.getItem(followedJobsKey("ws-1"))).toBeNull();
  });

  it("reads a followed run as soon as the server says one of its batches was written", async () => {
    const run = { id: "r-11", action: "assign_owner", status: "done", result: { matched: 2, selected: 2, processed: 2, changed: 2, skipped: {} } };
    window.localStorage.setItem(followedJobsKey("ws-1"), JSON.stringify([{ id: "r-11", kind: "run", since: Date.now() }]));
    getLeadActionRunAction.mockResolvedValue({ data: run, error: null });
    renderHarness(<Harness rows={["l-1"]} total={1} />);
    await waitFor(() => expect(bulkListeners.size).toBeGreaterThan(0));

    bulkListeners.forEach((listener) => listener({ runId: "r-other" }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getLeadActionRunAction).not.toHaveBeenCalled();

    bulkListeners.forEach((listener) => listener({ runId: "r-11" }));
    await waitFor(() => expect(getLeadActionRunAction).toHaveBeenCalledWith("r-11"), { timeout: 500 });
    await waitFor(() => expect(window.localStorage.getItem(followedJobsKey("ws-1"))).toBeNull(), { timeout: 500 });
  });

  it("forgets a followed run the server no longer knows, without a warning", async () => {
    const { toast } = await import("sonner");
    window.localStorage.setItem(followedJobsKey("ws-1"), JSON.stringify([{ id: "r-gone", kind: "run", since: Date.now() }]));
    getLeadActionRunAction.mockResolvedValue({ data: null, error: { status: 404, code: "lead_action_run_not_found" } });
    renderHarness(<Harness rows={["l-1"]} total={1} />);

    await waitFor(() => expect(window.localStorage.getItem(followedJobsKey("ws-1"))).toBeNull(), { timeout: 12000 });
    expect(toast.message).not.toHaveBeenCalledWith(bulk.runLost);
  }, 15000);

  it("shows how far a long preview has counted", async () => {
    previewLeadActionAction.mockResolvedValue({
      data: {
        id: "p-long",
        action: "export",
        status: "running",
        result: { matched: 120000, expectedCount: 120000, fingerprint: "fp-1", selected: 15000, eligible: 15000, skipped: {} },
      },
      error: null,
    });
    getLeadActionPreviewAction.mockReturnValue(new Promise(() => undefined));
    renderHarness(<Harness rows={["l-1"]} total={1} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    await openExport();
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Contando os leads: 15.000 de 120.000...")).toBeInTheDocument();
  });

  it("keeps Atribuir off until an owner, or the removal of the owner, is chosen", async () => {
    previewLeadActionAction.mockResolvedValue(preview(1));
    renderHarness(<Harness rows={["l-1"]} total={1} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    fireEvent.click(screen.getByRole("button", { name: bulk.actions.assign_owner }));
    const dialog = await screen.findByRole("dialog");
    const apply = within(dialog).getByRole("button", { name: bulk.dialog.apply.assign_owner });
    expect(within(dialog).getByText(bulk.dialog.previewWaiting)).toBeInTheDocument();
    expect(apply).toBeDisabled();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(previewLeadActionAction).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(`^${ptMessages.leadsPage.owner.label}`) }));
    fireEvent.click(await screen.findByRole("option", { name: ptMessages.leadsPage.owner.none }));
    await waitFor(() => expect(previewLeadActionAction).toHaveBeenCalled());
    expect(previewLeadActionAction.mock.calls[0][0].params).toEqual({ ownerId: "" });
    await waitFor(() => expect(apply).toBeEnabled());
  });

  it("follows two exports at once and downloads both files", async () => {
    const { toast } = await import("sonner");
    startLeadActionAction
      .mockResolvedValueOnce({ data: { action: "export", report: { id: "job-1", status: "queued", kind: "leads" } }, error: null })
      .mockResolvedValueOnce({ data: { action: "export", report: { id: "job-2", status: "queued", kind: "leads" } }, error: null });
    getReportAction.mockImplementation(async (id: string) => ({ data: { id, status: "done", kind: "leads", rowCount: 3 }, error: null }));
    fetchReportFileAction.mockImplementation(async (id: string) => ({ data: { blob: new Blob([id]), filename: `${id}.csv` }, error: null }));
    renderHarness(<Harness rows={["l-1", "l-2", "l-3"]} total={3} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));

    for (let round = 0; round < 2; round += 1) {
      await openExport();
      const dialog = await screen.findByRole("dialog");
      const apply = within(dialog).getByRole("button", { name: bulk.dialog.apply.export });
      await waitFor(() => expect(apply).toBeEnabled());
      fireEvent.click(apply);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    }

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2), { timeout: 4000 });
    expect(downloadBlob.mock.calls.map((call) => call[1]).sort()).toEqual(["job-1.csv", "job-2.csv"]);
    expect(toast.success).toHaveBeenCalledTimes(2);
  });

  it("offers a retry on a refused preview", async () => {
    previewLeadActionAction
      .mockResolvedValueOnce({ data: null, error: { code: "lead_action_selection_too_large", status: 413 } })
      .mockResolvedValueOnce(preview(1));
    renderHarness(<Harness rows={["l-1"]} total={1} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    await openExport();
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("button", { name: bulk.dialog.retry }));
    await waitFor(() => expect(previewLeadActionAction).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: bulk.dialog.apply.export })).toBeEnabled());
  });

  it("keeps Exportar off for a viewer who cannot read reports, as the server would", async () => {
    permissions.granted = new Set(ALL_PERMISSIONS.filter((entry) => entry !== "reports:read"));
    renderHarness(<Harness rows={["l-1"]} total={1} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    fireEvent.pointerDown(screen.getByRole("button", { name: bulk.more }), { button: 0, ctrlKey: false, pointerType: "mouse" });
    const item = await screen.findByRole("menuitem", { name: new RegExp(`^${bulk.actions.export}`) });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(within(item).getByText(bulk.blockers.permissionExport)).toBeInTheDocument();
  });

  it("builds the Meta audience on the account the workspace remembers, with the shared hashing note", async () => {
    listAdAccountsAction.mockResolvedValue({ data: [{ id: "act-1", name: "Conta principal", currency: "BRL" }] });
    renderHarness(<Harness rows={["l-1"]} total={1} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    fireEvent.pointerDown(screen.getByRole("button", { name: bulk.more }), { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(await screen.findByRole("menuitem", { name: new RegExp(`^${bulk.actions.meta_audience}`) }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(ptMessages.adsAudiences.hashing.title)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(ptMessages.adsAudiences.crm.name), { target: { value: "Base" } });
    await waitFor(() => expect(previewLeadActionAction).toHaveBeenCalled());
    expect(previewLeadActionAction.mock.calls.at(-1)?.[0].params).toEqual({ adAccountId: "act-1", name: "Base" });
  });

  it("acts on the whole area from the map bar, and shows that wide selection in the table bar with no picks", async () => {
    function Both() {
      const lead = useLeadBulk({ filter: BAIRRO, search: "", sorts: SORTS, filterInvalid: false, fields: [], onSettled: vi.fn() });
      return (
        <>
          <div data-testid="map">{lead.mapBar({ total: 1204, inArea: true })}</div>
          <div data-testid="table">
            <DashboardTable<{ id: string }>
              data={[{ id: "l-1" }]}
              columns={[{ key: "id", header: "Lead", render: (row) => row.id }]}
              rowKey={(row) => row.id}
              selection={lead.tableSelection(["l-1"], 1204)}
            />
          </div>
          {lead.dialog}
        </>
      );
    }
    renderHarness(<Both />);
    const map = screen.getByTestId("map");
    expect(within(map).getByText("1.204 leads na área desenhada")).toBeInTheDocument();
    expect(within(screen.getByTestId("table")).queryByText(/selecionados/)).not.toBeInTheDocument();

    fireEvent.pointerDown(within(map).getByRole("button", { name: bulk.more }), { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(await screen.findByRole("menuitem", { name: new RegExp(`^${bulk.actions.export}`) }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(previewLeadActionAction).toHaveBeenCalled());
    expect(previewLeadActionAction.mock.calls[0][0].selection).toEqual({ mode: "all_matching", filter: BAIRRO });
    fireEvent.click(within(dialog).getByRole("button", { name: bulk.dialog.cancel }));

    expect(within(screen.getByTestId("table")).getByText("Todos os 1.204 leads do filtro selecionados")).toBeInTheDocument();
  });

  it("keeps map picks on screen while the map total is unknown", () => {
    function Picked() {
      const lead = useLeadBulk({ filter: BAIRRO, search: "", sorts: SORTS, filterInvalid: false, fields: [], onSettled: vi.fn() });
      return (
        <>
          <button type="button" onClick={() => lead.onMapPicksChange({ p1: ["l-1", "l-2"] })}>
            pick
          </button>
          {lead.mapBar({ total: null, inArea: false })}
        </>
      );
    }
    renderHarness(<Picked />);
    expect(screen.queryByText("2 selecionados")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "pick" }));
    expect(screen.getByText("2 selecionados")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: bulk.clear }));
    expect(screen.queryByText("2 selecionados")).not.toBeInTheDocument();
  });


  it("disables each action with its reason", () => {
    permissions.granted = new Set(["leads:read", "leads:update", "leads:bulk_update"]);
    renderHarness(<Harness rows={["l-1"]} total={1} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    expect(screen.getByRole("button", { name: `${bulk.actions.send_template}. ${bulk.blockers.permissionSendTemplate}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `${bulk.actions.send_message}. ${bulk.blockers.permissionSendUnofficial}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `${bulk.actions.call_list}. ${bulk.blockers.permissionCallList}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `${bulk.actions.classify}. ${bulk.blockers.noFields}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `${bulk.actions.assign_owner}. ${bulk.blockers.permissionAssign}` })).toBeDisabled();
  });

  const SEND_PERMISSIONS = [
    "leads:read",
    "whatsapp_campaigns:create",
    "whatsapp_campaigns:start",
    "whatsapp_templates:send",
    "whatsapp_templates:read",
    "business_phones:read",
    "conversations:read",
    "unofficial_whatsapp_campaigns:create",
    "unofficial_whatsapp_campaigns:start",
    "unofficial_whatsapp_instances:read",
  ];

  it("says which send has no connected number to go out from", async () => {
    permissions.granted = new Set(SEND_PERMISSIONS);
    listInstancesAction.mockResolvedValue({ instances: [] });
    renderHarness(<Harness rows={["l-1"]} total={1} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    expect(await screen.findByRole("button", { name: `${bulk.actions.send_message}. ${bulk.blockers.noUnofficialNumber}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: bulk.actions.send_template })).toBeEnabled();
    expect(listInstancesAction).toHaveBeenCalledWith(1, 1, undefined, "CONNECTED");
    expect(listBusinessPhonesAction).toHaveBeenCalledWith({ status: "CONNECTED", page: 1, pageSize: 1 });
  });

  it("names the official channel without a connected number, and refuses when the numbers cannot be read", async () => {
    permissions.granted = new Set(SEND_PERMISSIONS);
    listBusinessPhonesAction.mockResolvedValue({ phones: [] });
    listInstancesAction.mockResolvedValue({ instances: [], error: "boom" });
    renderHarness(<Harness rows={["l-1"]} total={1} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    expect(await screen.findByRole("button", { name: `${bulk.actions.send_template}. ${bulk.blockers.noOfficialNumber}` })).toBeDisabled();
    expect(await screen.findByRole("button", { name: `${bulk.actions.send_message}. ${bulk.blockers.numbersUnavailable}` })).toBeDisabled();
  });

  it("offers the sends to whoever holds them and has a connected number", async () => {
    permissions.granted = new Set(SEND_PERMISSIONS);
    renderHarness(<Harness rows={["l-1"]} total={1} />);
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.leadsPage.selection.selectPage }));
    await waitFor(() => expect(screen.getByRole("button", { name: bulk.actions.send_template })).toBeEnabled());
    expect(screen.getByRole("button", { name: bulk.actions.send_message })).toBeEnabled();
  });
});
