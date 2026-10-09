import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";

import { NextIntlClientProvider } from "next-intl";
import ptMessages from "@/i18n/messages/pt.json";
import type { Label, Stage } from "@/lib/conversations/types";
import type { CrmFilter } from "@/lib/crm/board";
import { emptyCrmFilter, readFilterValues } from "@/lib/crm/board";


const getCrmEntriesAction = vi.fn();
const crmBulkAction = vi.fn();
const countCrmBulkAction = vi.fn();
const getBatchEntryStagesAction = vi.fn();
const listAssignableMembersAction = vi.fn();

vi.mock("@/app/actions/crm-board", () => ({
  getCrmEntriesAction: (...a: unknown[]) => getCrmEntriesAction(...a),
  crmBulkAction: (...a: unknown[]) => crmBulkAction(...a),
  countCrmBulkAction: (...a: unknown[]) => countCrmBulkAction(...a),
}));
vi.mock("@/app/actions/stages", () => ({
  getBatchEntryStagesAction: (...a: unknown[]) => getBatchEntryStagesAction(...a),
}));
vi.mock("@/app/actions/workspace", () => ({
  listAssignableMembersAction: (...a: unknown[]) => listAssignableMembersAction(...a),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import CrmFilterBar from "../CrmFilterBar";
import CrmListView from "../CrmListView";


const STAGES: Stage[] = [
  { id: "stage-a", name: "Proposta", color: "#00d09a", position: 0 },
  { id: "stage-b", name: "Fechado", color: "#2563eb", position: 1 },
] as unknown as Stage[];

const LABELS: Label[] = [] as unknown as Label[];

function entry(id: string) {
  return {
    EntryID: id,
    EntryType: "whatsapp",
    LeadName: `Lead ${id}`,
    LeadNumber: "+5511999999999",
    LastMessageAt: "2026-08-13T17:30:00.000Z",
  };
}

function pageOf(n: number, total: number) {
  return {
    result: {
      entries: Array.from({ length: n }, (_, i) => entry(`e${i + 1}`)),
      total,
    },
  };
}

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getBatchEntryStagesAction.mockResolvedValue({ entryStages: {} });
  listAssignableMembersAction.mockResolvedValue({ members: [] });
  crmBulkAction.mockResolvedValue({ result: { succeeded: 0, failed: [] } });
});


describe("CrmFilterBar stage filter", () => {
  it("writes a `stage in [...]` predicate the backend already understands", async () => {
    let current: CrmFilter = emptyCrmFilter;
    const onChange = vi.fn((f: CrmFilter) => {
      current = f;
    });

    wrap(
      <CrmFilterBar
        value={current}
        onChange={onChange}
        labels={LABELS}
        stages={STAGES}
      />,
    );

    fireEvent.click(screen.getByText("Etapa"));
    fireEvent.click(await screen.findByText("Proposta"));

    expect(onChange).toHaveBeenCalled();
    expect(readFilterValues(current, "stage", "in")).toEqual(["stage-a"]);
  });

  it("offers stages in position order, not insertion order", async () => {
    wrap(
      <CrmFilterBar
        value={emptyCrmFilter}
        onChange={vi.fn()}
        labels={LABELS}
        stages={[STAGES[1], STAGES[0]]}
      />,
    );

    fireEvent.click(screen.getByText("Etapa"));
    await screen.findByText("Proposta");
    const rendered = screen.getAllByText(/Proposta|Fechado/).map((n) => n.textContent);
    expect(rendered).toEqual(["Proposta", "Fechado"]);
  });

  it("hides the control when the caller has no stages to offer", () => {
    wrap(<CrmFilterBar value={emptyCrmFilter} onChange={vi.fn()} labels={LABELS} />);
    expect(screen.queryByText("Etapa")).toBeNull();
  });
});


describe("CrmListView bulk targeting", () => {
  const stageFilter: CrmFilter = {
    groups: [
      {
        conjunction: "and",
        predicates: [{ field: "stage", operator: "in", values: ["stage-a"] }],
      },
    ],
  };

  function renderList(filter: CrmFilter = stageFilter) {
    return wrap(
      <CrmListView
        filter={filter}
        stages={STAGES}
        labels={LABELS}
        workspaceId="ws-1"
        canAssignStage
      />,
    );
  }

  async function selectWholePage() {
    const boxes = await screen.findAllByRole("checkbox");
    fireEvent.click(boxes[0]);
  }

  async function moveToStageB() {
    fireEvent.click(await screen.findByText("Mover etapa"));
    fireEvent.click(await screen.findByText("Fechado"));
  }

  async function selectAllMatching(label = "Selecionar todas as 340 do filtro") {
    await selectWholePage();
    fireEvent.click(await screen.findByText(label));
  }

  it("sends the picked rows as explicit ids without asking", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(3, 3));
    renderList();
    await screen.findByText("Lead e1");

    await selectWholePage();
    await moveToStageB();

    await waitFor(() => expect(crmBulkAction).toHaveBeenCalled());
    expect(crmBulkAction.mock.calls[0][0]).toEqual({
      action: "move_stage",
      value: "stage-b",
      mode: "ids",
      targets: [
        { entryId: "e1", entryType: "whatsapp" },
        { entryId: "e2", entryType: "whatsapp" },
        { entryId: "e3", entryType: "whatsapp" },
      ],
    });
    expect(countCrmBulkAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("offers the whole matching set once the page is exhausted", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(20, 340));
    renderList();
    await screen.findByText("Lead e1");

    await selectWholePage();

    expect(await screen.findByText("Selecionar todas as 340 do filtro")).toBeInTheDocument();
  });

  it("does not offer it when the page already is the whole set", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(3, 3));
    renderList();
    await screen.findByText("Lead e1");

    await selectWholePage();

    expect(screen.queryByText(/Selecionar todas as/)).toBeNull();
  });

  it("counts on the server before selecting all matching and shows the server count", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(20, 340));
    countCrmBulkAction.mockResolvedValue({ count: { matched: 352, fingerprint: "fp-1" } });
    renderList();
    await screen.findByText("Lead e1");

    await selectAllMatching();

    expect(countCrmBulkAction).toHaveBeenCalledWith(stageFilter);
    expect(await screen.findByText("Todas as 352 conversas do filtro selecionadas")).toBeInTheDocument();
  });

  it("applies all matching only after confirming, with the counted total and fingerprint", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(20, 340));
    countCrmBulkAction.mockResolvedValue({ count: { matched: 352, fingerprint: "fp-1" } });
    crmBulkAction.mockResolvedValue({ result: { succeeded: 352, failed: [], matched: 352, eligible: 352 } });
    renderList();
    await screen.findByText("Lead e1");

    await selectAllMatching();
    await screen.findByText("Todas as 352 conversas do filtro selecionadas");
    await moveToStageB();

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Aplicar a 352 conversas?")).toBeInTheDocument();
    expect(crmBulkAction).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));

    await waitFor(() => expect(crmBulkAction).toHaveBeenCalled());
    expect(crmBulkAction.mock.calls[0][0]).toEqual({
      action: "move_stage",
      value: "stage-b",
      mode: "all_matching",
      filter: stageFilter,
      expectedCount: 352,
      fingerprint: "fp-1",
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("352 conversas atualizadas"));
  });

  it("applies nothing when the confirmation is cancelled", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(20, 340));
    countCrmBulkAction.mockResolvedValue({ count: { matched: 340, fingerprint: "fp-1" } });
    renderList();
    await screen.findByText("Lead e1");

    await selectAllMatching();
    await screen.findByText("Todas as 340 conversas do filtro selecionadas");
    await moveToStageB();

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(crmBulkAction).not.toHaveBeenCalled();
  });

  it("asks explicitly before applying to everyone when no filter is active", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(20, 340));
    countCrmBulkAction.mockResolvedValue({ count: { matched: 340, fingerprint: "fp-all" } });
    crmBulkAction.mockResolvedValue({ result: { succeeded: 340, failed: [], matched: 340, eligible: 340 } });
    renderList(emptyCrmFilter);
    await screen.findByText("Lead e1");

    await selectAllMatching("Selecionar todas as 340 conversas");
    await screen.findByText("Todas as 340 conversas que você vê selecionadas");
    await moveToStageB();

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("Nenhum filtro está ativo: a ação vale para todas as conversas que você pode ver."),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar a todas" }));

    await waitFor(() => expect(crmBulkAction).toHaveBeenCalled());
    expect(countCrmBulkAction).toHaveBeenCalledWith(emptyCrmFilter);
    expect(crmBulkAction.mock.calls[0][0]).toEqual({
      action: "move_stage",
      value: "stage-b",
      mode: "everyone",
      expectedCount: 340,
      fingerprint: "fp-all",
    });
  });

  it("shows the new total and asks again when the selection changed since the count", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(20, 340));
    countCrmBulkAction
      .mockResolvedValueOnce({ count: { matched: 340, fingerprint: "fp-1" } })
      .mockResolvedValueOnce({ count: { matched: 352, fingerprint: "fp-1" } });
    crmBulkAction
      .mockResolvedValueOnce({
        result: null,
        error: { message: "A seleção mudou desde a contagem", code: "selection_changed", status: 409 },
      })
      .mockResolvedValueOnce({ result: { succeeded: 352, failed: [], matched: 352, eligible: 352 } });
    renderList();
    await screen.findByText("Lead e1");

    await selectAllMatching();
    await screen.findByText("Todas as 340 conversas do filtro selecionadas");
    await moveToStageB();

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));

    expect(
      await within(dialog).findByText(
        "A seleção mudou desde a contagem: eram 340, agora são 352. Confirme de novo para aplicar.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Aplicar a 352 conversas?")).toBeInTheDocument();
    expect(crmBulkAction).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));

    await waitFor(() => expect(crmBulkAction).toHaveBeenCalledTimes(2));
    expect(crmBulkAction.mock.calls[1][0]).toMatchObject({
      mode: "all_matching",
      expectedCount: 352,
      fingerprint: "fp-1",
    });
  });

  it("reports a truncated run with the counted total", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(20, 2300));
    countCrmBulkAction.mockResolvedValue({ count: { matched: 2300, fingerprint: "fp-1" } });
    crmBulkAction.mockResolvedValue({
      result: { succeeded: 2000, failed: [], matched: 2300, eligible: 2000, truncated: true },
    });
    renderList();
    await screen.findByText("Lead e1");

    await selectAllMatching("Selecionar todas as 2300 do filtro");
    await screen.findByText("Todas as 2300 conversas do filtro selecionadas");
    await moveToStageB();
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Aplicar" }));

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        "2000 de 2300 conversas atualizadas: a ação atingiu o limite por operação. Repita para continuar.",
      ),
    );
  });

  it("reports the entries that could not change out of the eligible ones", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(3, 3));
    crmBulkAction.mockResolvedValue({
      result: { succeeded: 2, failed: [{ entryId: "e3", error: "forbidden" }], matched: 3, eligible: 3 },
    });
    renderList();
    await screen.findByText("Lead e1");

    await selectWholePage();
    await moveToStageB();

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith("2 de 3 conversas atualizadas. 1 não pôde ser alterada."),
    );
  });

  it("explains a refusal by its code", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(3, 3));
    crmBulkAction.mockResolvedValue({
      result: null,
      error: { message: "The selection is outside your department scope", code: "selection_scope_denied", status: 403 },
    });
    renderList();
    await screen.findByText("Lead e1");

    await selectWholePage();
    await moveToStageB();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "O departamento escolhido está fora do seu acesso. Troque de departamento e tente de novo.",
      ),
    );
  });

  it("keeps the page selection when the count is busy", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(20, 340));
    countCrmBulkAction.mockResolvedValue({
      count: null,
      error: { message: "Bulk selection analytics are busy, retry shortly", status: 503 },
    });
    renderList();
    await screen.findByText("Lead e1");

    await selectAllMatching();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Muitas contagens em andamento. Tente de novo em instantes."),
    );
    expect(screen.queryByText(/conversas do filtro selecionadas/)).toBeNull();
    expect(screen.getByText("Selecionar todas as 340 do filtro")).toBeInTheDocument();
  });

  it("drops the all-matching mode when the selection is hand-edited", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(20, 340));
    countCrmBulkAction.mockResolvedValue({ count: { matched: 340, fingerprint: "fp-1" } });
    renderList();
    await screen.findByText("Lead e1");

    await selectAllMatching();
    await screen.findByText("Todas as 340 conversas do filtro selecionadas");

    const boxes = await screen.findAllByRole("checkbox");
    fireEvent.click(boxes[1]);

    await waitFor(() =>
      expect(screen.queryByText("Todas as 340 conversas do filtro selecionadas")).toBeNull(),
    );
  });
});
