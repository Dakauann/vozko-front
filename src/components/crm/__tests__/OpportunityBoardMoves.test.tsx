import { render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { Opportunity, OpportunityColumn } from "@/lib/crm/opportunities";
import { fakeBoardLayout, flushTimers, keyboardMove } from "@/test/board-layout";

const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
);
const actions = vi.hoisted(() => ({
  getOpportunityBoardAction: vi.fn(),
  moveOpportunityAction: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/app/actions/opportunities", () => actions);
vi.mock("@/app/actions/crm-board", () => ({
  listPipelinesAction: vi.fn().mockResolvedValue({ pipelines: [] }),
}));
vi.mock("@/app/actions/custom-fields", () => ({
  listCustomFieldsAction: vi.fn().mockResolvedValue({ fields: [] }),
}));
vi.mock("@/app/actions/workspace", () => ({
  listAssignableMembersAction: vi.fn().mockResolvedValue({ members: [] }),
}));
vi.mock("@/components/crm/CrmFilterBar", () => ({ default: () => null }));
vi.mock("@/components/crm/OpportunityDrawer", () => ({ default: () => null }));
vi.mock("@/components/crm/CustomFieldManager", () => ({ default: () => null }));

import OpportunityBoard from "../OpportunityBoard";

function deal(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "d1",
    workspaceId: "w1",
    pipelineId: "p1",
    stageId: "a",
    title: "Contrato anual",
    valueCents: 5000,
    currency: "BRL",
    status: "open",
    version: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function boardWith(entriesA: Opportunity[], entriesB: Opportunity[]): { columns: OpportunityColumn[] } {
  return {
    columns: [
      { id: "a", name: "Novo", total: entriesA.length, valueTotal: 5000, entries: entriesA },
      { id: "b", name: "Proposta", total: entriesB.length, valueTotal: 0, entries: entriesB },
    ],
  };
}

function column(id: string): HTMLElement {
  return document.querySelector(`[data-column-id='${id}']`) as HTMLElement;
}

async function renderBoard() {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <OpportunityBoard pipelineId="p1" workspaceId="w1" />
    </NextIntlClientProvider>,
  );
  return screen.findByRole("button", { name: /Contrato anual/ });
}

describe("opportunity board moves", () => {
  beforeEach(() => {
    window.localStorage.clear();
    toastMock.mockClear();
    toastMock.error.mockClear();
    actions.moveOpportunityAction.mockReset();
    actions.getOpportunityBoardAction.mockReset();
    actions.getOpportunityBoardAction.mockResolvedValue({ board: boardWith([deal()], []) });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(fakeBoardLayout(["a", "b"]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rolls the deal back to its column when the server refuses the move", async () => {
    let refuse: (value: { opportunity: null; error: string }) => void = () => {};
    actions.moveOpportunityAction.mockReturnValue(
      new Promise((resolve) => {
        refuse = resolve;
      }),
    );
    const card = await renderBoard();

    await keyboardMove(card, "ArrowRight");
    expect(within(column("b")).getByText("Contrato anual")).toBeInTheDocument();

    refuse({ opportunity: null, error: "Versão desatualizada" });
    await flushTimers();

    expect(toastMock.error).toHaveBeenCalledWith("Versão desatualizada");
    expect(within(column("a")).getByText("Contrato anual")).toBeInTheDocument();
    await waitFor(() =>
      expect(within(column("b")).queryByText("Contrato anual")).not.toBeInTheDocument(),
    );
  });

  it("offers undo after an accepted move, sending the deal back with its current version", async () => {
    actions.moveOpportunityAction.mockResolvedValue({ opportunity: deal({ stageId: "b", version: 4 }) });
    const card = await renderBoard();
    actions.getOpportunityBoardAction.mockResolvedValue({
      board: boardWith([], [deal({ stageId: "b", version: 4 })]),
    });

    await keyboardMove(card, "ArrowRight");
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(actions.getOpportunityBoardAction).toHaveBeenCalledTimes(2),
    );
    await flushTimers();

    const [message, options] = toastMock.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("Movido para Proposta");
    options.action.onClick();
    await flushTimers();

    expect(actions.moveOpportunityAction).toHaveBeenLastCalledWith("d1", { stageId: "a", version: 4 });
  });
});
