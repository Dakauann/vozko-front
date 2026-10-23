import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getWorkflowChoiceStatsAction } = vi.hoisted(() => ({ getWorkflowChoiceStatsAction: vi.fn() }));

vi.mock("@/app/actions/workflows", () => ({ getWorkflowChoiceStatsAction }));

import { readWorkflowChoiceStats, type WorkflowChoiceStats } from "@/lib/choice-stats/stats";

import {
  ChoiceStatsContext,
  createChoiceStatsStore,
  nodeChoiceView,
  settleChoiceStats,
  useChoiceStatsLoader,
  useNodeChoiceStats,
  type ChoiceStatsStore,
} from "./choice-stats-store";

function promptOf(sends: number) {
  return { sends, clickedPrompts: 1, clickRate: 5000, freeText: { count: 0, rate: 0 }, options: [{ optionId: "sim", shown: sends, clicks: 1, ctr: 5000 }] };
}

function statsOf(nodes: Record<string, number>): WorkflowChoiceStats {
  return readWorkflowChoiceStats({
    from: "2026-10-16",
    to: "2026-10-22",
    timezone: "America/Sao_Paulo",
    version: null,
    nodes: Object.entries(nodes).map(([nodeId, sends]) => ({ nodeId, ...promptOf(sends) })),
  })!;
}

function wrapperOf(store: ChoiceStatsStore) {
  return function ChoiceStatsWrapper({ children }: { children: ReactNode }) {
    return <ChoiceStatsContext.Provider value={store}>{children}</ChoiceStatsContext.Provider>;
  };
}

describe("nodeChoiceView", () => {
  it("shows the node's stats when the canvas read them", () => {
    const state = settleChoiceStats(createChoiceStatsStore().get(), { status: "ready", stats: statsOf({ menu: 2 }) });
    expect(nodeChoiceView(state, "menu")).toMatchObject({ kind: "stats", stats: { sends: 2 } });
  });

  it("says a node without sends has none, since the backend omits it", () => {
    const state = settleChoiceStats(createChoiceStatsStore().get(), { status: "ready", stats: statsOf({ menu: 2 }) });
    expect(nodeChoiceView(state, "other")).toEqual({ kind: "no_sends" });
  });

  it("shows nothing on a node while the stats are unreadable or refused, never zeros", () => {
    const empty = createChoiceStatsStore().get();
    expect(nodeChoiceView(empty, "menu")).toBeNull();
    expect(nodeChoiceView(settleChoiceStats(empty, { status: "unreadable" }), "menu")).toBeNull();
    expect(nodeChoiceView(settleChoiceStats(empty, { status: "failed", message: "x", code: "choice_stats_unavailable" }), "menu")).toBeNull();
  });
});

describe("useNodeChoiceStats", () => {
  it("reads nothing outside the editor", () => {
    const { result } = renderHook(() => useNodeChoiceStats("menu"));
    expect(result.current).toBeNull();
  });

  it("re-renders a node only when its own stats change", () => {
    const store = createChoiceStatsStore();
    store.set(settleChoiceStats(store.get(), { status: "ready", stats: statsOf({ a: 5, b: 7 }) }));
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;
        return useNodeChoiceStats("a");
      },
      { wrapper: wrapperOf(store) },
    );
    const first = result.current;
    const before = renders;

    act(() => store.set(settleChoiceStats(store.get(), { status: "ready", stats: statsOf({ a: 5, b: 9 }) })));
    expect(renders).toBe(before);
    expect(result.current).toBe(first);

    act(() => store.set(settleChoiceStats(store.get(), { status: "ready", stats: statsOf({ a: 6, b: 9 }) })));
    expect(renders).toBe(before + 1);
    expect(result.current).toMatchObject({ kind: "stats", stats: { sends: 6 } });
  });
});

describe("useChoiceStatsLoader", () => {
  beforeEach(() => getWorkflowChoiceStatsAction.mockReset());

  it("loads once per editor open and per period, never on other re-renders", async () => {
    getWorkflowChoiceStatsAction.mockResolvedValue({ status: "ready", stats: statsOf({ menu: 3 }) });
    const store = createChoiceStatsStore();
    const { rerender } = renderHook(({ id, days }) => useChoiceStatsLoader(store, id, days), {
      initialProps: { id: "wf-1" as string | null, days: "30d" as "7d" | "30d" | "90d" },
    });
    await waitFor(() => expect(store.get().result?.status).toBe("ready"));
    rerender({ id: "wf-1", days: "30d" });
    expect(getWorkflowChoiceStatsAction).toHaveBeenCalledTimes(1);

    rerender({ id: "wf-1", days: "7d" });
    await waitFor(() => expect(getWorkflowChoiceStatsAction).toHaveBeenCalledTimes(2));
    const [workflowId, range] = getWorkflowChoiceStatsAction.mock.calls[1];
    expect(workflowId).toBe("wf-1");
    expect(range).toEqual({ from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it("asks nothing for an unsaved workflow", () => {
    const store = createChoiceStatsStore();
    renderHook(() => useChoiceStatsLoader(store, null, "30d"));
    expect(getWorkflowChoiceStatsAction).not.toHaveBeenCalled();
    expect(store.get().result).toBeNull();
  });

  it("keeps the last numbers while a new period loads", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    getWorkflowChoiceStatsAction.mockResolvedValueOnce({ status: "ready", stats: statsOf({ menu: 3 }) });
    getWorkflowChoiceStatsAction.mockReturnValueOnce(new Promise((next) => (resolve = next)));
    const store = createChoiceStatsStore();
    const { rerender } = renderHook(({ days }) => useChoiceStatsLoader(store, "wf-1", days), { initialProps: { days: "30d" as "7d" | "30d" } });
    await waitFor(() => expect(store.get().result?.status).toBe("ready"));
    rerender({ days: "7d" });
    expect(store.get().loading).toBe(true);
    expect(nodeChoiceView(store.get(), "menu")).toMatchObject({ kind: "stats" });
    await act(async () => resolve({ status: "unreadable" }));
    expect(store.get()).toMatchObject({ loading: false, result: { status: "unreadable" } });
  });

  it("retries on request", async () => {
    getWorkflowChoiceStatsAction.mockResolvedValue({ status: "failed", message: "x", code: "choice_stats_unavailable" });
    const store = createChoiceStatsStore();
    const { result } = renderHook(() => useChoiceStatsLoader(store, "wf-1", "30d"));
    await waitFor(() => expect(store.get().result?.status).toBe("failed"));
    act(() => result.current());
    await waitFor(() => expect(getWorkflowChoiceStatsAction).toHaveBeenCalledTimes(2));
  });
});
