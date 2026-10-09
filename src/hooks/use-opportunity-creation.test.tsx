import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  listPipelinesAction: vi.fn(),
  getOpportunityBoardAction: vi.fn(),
  listCustomFieldsAction: vi.fn(),
}));

vi.mock("@/app/actions/crm-board", () => ({ listPipelinesAction: actions.listPipelinesAction }));
vi.mock("@/app/actions/opportunities", () => ({ getOpportunityBoardAction: actions.getOpportunityBoardAction }));
vi.mock("@/app/actions/custom-fields", () => ({ listCustomFieldsAction: actions.listCustomFieldsAction }));

import type { Opportunity } from "@/lib/crm/opportunities";

import { useOpportunityCreation, useOpportunityDrawer } from "./use-opportunity-creation";

const column = { id: "s-1", name: "Novo", total: 0, valueTotal: 0, entries: null };

beforeEach(() => {
  vi.clearAllMocks();
  actions.listPipelinesAction.mockResolvedValue({
    pipelines: [
      { id: "p-2", name: "Outro", isDefault: false },
      { id: "p-1", name: "Vendas", isDefault: true },
    ],
  });
  actions.getOpportunityBoardAction.mockResolvedValue({ board: { groupBy: "stage", columns: [column] } });
  actions.listCustomFieldsAction.mockResolvedValue({ fields: [{ id: "f-1", key: "origem" }] });
});

describe("useOpportunityCreation", () => {
  it("opens on the stages of the default opportunity pipeline, without reading its deals", async () => {
    const { result } = renderHook(() => useOpportunityCreation());

    let opened = false;
    await act(async () => {
      opened = await result.current.start();
    });

    expect(opened).toBe(true);
    expect(result.current.open).toBe(true);
    expect(result.current.setup).toEqual({ pipelineId: "p-1", columns: [column], customFields: [{ id: "f-1", key: "origem" }] });
    expect(actions.listPipelinesAction).toHaveBeenCalledWith("opportunity");
    expect(actions.listCustomFieldsAction).toHaveBeenCalledWith("opportunity");
    expect(actions.getOpportunityBoardAction).toHaveBeenCalledWith({ groupBy: "stage", pipelineId: "p-1", pageSize: 1 });
  });

  it("stays closed without a pipeline, without stages, or when the fields could not be read", async () => {
    const { result } = renderHook(() => useOpportunityCreation());
    const attempt = async () => {
      let opened = true;
      await act(async () => {
        opened = await result.current.start();
      });
      return opened;
    };

    actions.listPipelinesAction.mockResolvedValueOnce({ pipelines: [] });
    expect(await attempt()).toBe(false);

    actions.getOpportunityBoardAction.mockResolvedValueOnce({ board: { groupBy: "stage", columns: [] } });
    expect(await attempt()).toBe(false);

    actions.listCustomFieldsAction.mockResolvedValueOnce({ fields: [], error: "boom" });
    expect(await attempt()).toBe(false);

    actions.listPipelinesAction.mockRejectedValueOnce(new Error("offline"));
    expect(await attempt()).toBe(false);

    expect(result.current.open).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("opens a deal on the stages of its own pipeline, not the default one", async () => {
    const { result } = renderHook(() => useOpportunityDrawer());
    const deal = { id: "d-1", pipelineId: "p-2", stageId: "s-1" } as Opportunity;

    let opened = false;
    await act(async () => {
      opened = await result.current.edit(deal);
    });

    expect(opened).toBe(true);
    expect(result.current.opportunity).toBe(deal);
    expect(result.current.setup?.pipelineId).toBe("p-2");
    expect(actions.getOpportunityBoardAction).toHaveBeenCalledWith({ groupBy: "stage", pipelineId: "p-2", pageSize: 1 });
  });

  it("refuses to open a deal whose pipeline the viewer cannot see", async () => {
    const { result } = renderHook(() => useOpportunityDrawer());

    let opened = true;
    await act(async () => {
      opened = await result.current.edit({ id: "d-1", pipelineId: "p-9", stageId: "s-1" } as Opportunity);
    });

    expect(opened).toBe(false);
    expect(result.current.open).toBe(false);
    expect(actions.getOpportunityBoardAction).not.toHaveBeenCalled();
  });

  it("forgets the deal it edited when it next opens to create one", async () => {
    const { result } = renderHook(() => useOpportunityDrawer());

    await act(async () => {
      await result.current.edit({ id: "d-1", pipelineId: "p-2", stageId: "s-1" } as Opportunity);
    });
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.opportunity).toBeNull();
    expect(result.current.setup?.pipelineId).toBe("p-1");
  });
});
