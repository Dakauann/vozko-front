import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { NextIntlClientProvider } from "next-intl";
import ptMessages from "@/i18n/messages/pt.json";
import type { Label, Stage } from "@/lib/conversations/types";
import type { CrmFilter } from "@/lib/crm/board";
import { emptyCrmFilter, readFilterValues } from "@/lib/crm/board";

// --- server-action doubles ---------------------------------------------------

const getCrmEntriesAction = vi.fn();
const crmBulkAction = vi.fn();
const getBatchEntryStagesAction = vi.fn();
const listAssignableMembersAction = vi.fn();

vi.mock("@/app/actions/crm-board", () => ({
  getCrmEntriesAction: (...a: unknown[]) => getCrmEntriesAction(...a),
  crmBulkAction: (...a: unknown[]) => crmBulkAction(...a),
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

// --- fixtures ----------------------------------------------------------------

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

/** A page of `n` entries out of `total`, so the "select all" offer can appear. */
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

// --- the filter control ------------------------------------------------------

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
    // The field/operator pair matters: `stage` + `in` is what the conversation
    // descriptor compiles to the entry_stages membership subquery.
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

// --- bulk over the whole filtered set ----------------------------------------

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
    // The header checkbox picks every rendered row.
    const boxes = await screen.findAllByRole("checkbox");
    fireEvent.click(boxes[0]);
  }

  async function moveToStageB() {
    fireEvent.click(await screen.findByText("Mover etapa"));
    fireEvent.click(await screen.findByText("Fechado"));
  }

  it("sends the picked rows as explicit targets by default", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(3, 3));
    renderList();
    await screen.findByText("Lead e1");

    await selectWholePage();
    await moveToStageB();

    await waitFor(() => expect(crmBulkAction).toHaveBeenCalled());
    const payload = crmBulkAction.mock.calls[0][0];
    expect(payload.action).toBe("move_stage");
    expect(payload.value).toBe("stage-b");
    expect(payload.targets).toHaveLength(3);
    expect(payload.filter).toBeUndefined();
  });

  it("offers the whole matching set once the page is exhausted", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(20, 340));
    renderList();
    await screen.findByText("Lead e1");

    await selectWholePage();

    expect(
      await screen.findByText("Selecionar todas as 340 do filtro"),
    ).toBeInTheDocument();
  });

  it("does not offer it when the page already is the whole set", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(3, 3));
    renderList();
    await screen.findByText("Lead e1");

    await selectWholePage();

    expect(screen.queryByText(/Selecionar todas as/)).toBeNull();
  });

  it("sends the filter instead of ids once all matching is chosen", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    getCrmEntriesAction.mockResolvedValue(pageOf(20, 340));
    renderList();
    await screen.findByText("Lead e1");

    await selectWholePage();
    fireEvent.click(await screen.findByText("Selecionar todas as 340 do filtro"));
    await moveToStageB();

    await waitFor(() => expect(crmBulkAction).toHaveBeenCalled());
    const payload = crmBulkAction.mock.calls[0][0];
    // No ids: the server re-runs the filter under the caller's own scope, so the
    // 320 rows that were never rendered are included.
    expect(payload.targets).toEqual([]);
    expect(payload.filter).toEqual(stageFilter);
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("confirms before applying to rows the operator cannot see", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    getCrmEntriesAction.mockResolvedValue(pageOf(20, 340));
    renderList();
    await screen.findByText("Lead e1");

    await selectWholePage();
    fireEvent.click(await screen.findByText("Selecionar todas as 340 do filtro"));
    await moveToStageB();

    expect(confirm).toHaveBeenCalled();
    expect(crmBulkAction).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("drops the all-matching mode when the selection is hand-edited", async () => {
    getCrmEntriesAction.mockResolvedValue(pageOf(20, 340));
    renderList();
    await screen.findByText("Lead e1");

    await selectWholePage();
    fireEvent.click(await screen.findByText("Selecionar todas as 340 do filtro"));
    await screen.findByText("Todas as 340 conversas do filtro selecionadas");

    // Unpicking a single row means the operator is naming rows again.
    const boxes = await screen.findAllByRole("checkbox");
    fireEvent.click(boxes[1]);

    await waitFor(() =>
      expect(
        screen.queryByText("Todas as 340 conversas do filtro selecionadas"),
      ).toBeNull(),
    );
  });
});
