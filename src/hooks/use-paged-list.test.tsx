import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const poll = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>> }));

vi.mock("@/hooks/use-poll-while", () => ({
  usePollWhile: (options: Record<string, unknown>) => {
    poll.calls.push(options);
  },
}));

import { usePagedList, type PageAnswer } from "./use-paged-list";

interface Row {
  id: string;
  live?: boolean;
}

function answer(items: Row[], totalPages = 1, error?: string): PageAnswer<Row> {
  return { items, meta: { page: 1, pageSize: 10, totalPages, totalItems: items.length }, error };
}

function lastPoll() {
  return poll.calls[poll.calls.length - 1] as {
    active: boolean;
    read: () => Promise<{ data: unknown; error: unknown }>;
    isOver: (value: { items: Row[] }) => boolean;
    onValue: (value: { items: Row[]; meta: unknown }) => void;
  };
}

describe("usePagedList", () => {
  beforeEach(() => {
    poll.calls = [];
  });

  it("reads the first page and reports loading until it lands", async () => {
    const read = vi.fn(async () => answer([{ id: "a" }], 3));
    const { result } = renderHook(() => usePagedList({ scope: "wf-1", read }));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([{ id: "a" }]);
    expect(result.current.totalPages).toBe(3);
    expect(read).toHaveBeenCalledWith(1);
  });

  it("replaces the rows when the page changes", async () => {
    const read = vi.fn(async (page: number) => answer([{ id: `p${page}` }], 2));
    const { result } = renderHook(() => usePagedList({ scope: "wf-1", read }));
    await waitFor(() => expect(result.current.items).toEqual([{ id: "p1" }]));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.items).toEqual([{ id: "p2" }]));
  });

  it("appends later pages without repeating a row when it loads more", async () => {
    const read = vi.fn(async (page: number) => answer(page === 1 ? [{ id: "a" }, { id: "b" }] : [{ id: "b" }, { id: "c" }], 2));
    const { result } = renderHook(() => usePagedList({ scope: "wf-1", read, accumulate: true }));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.items.map((row) => row.id)).toEqual(["a", "b", "c"]));
  });

  it("goes back to the first page on refresh when it loads more, so the list starts fresh", async () => {
    const read = vi.fn(async (page: number) => answer([{ id: `p${page}` }], 2));
    const { result } = renderHook(() => usePagedList({ scope: "wf-1", read, accumulate: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.items).toEqual([{ id: "p1" }]));
    expect(result.current.page).toBe(1);
  });

  it("reports a failed read and keeps no stale rows", async () => {
    const read = vi.fn(async () => answer([], 1, "down"));
    const { result } = renderHook(() => usePagedList({ scope: "wf-1", read }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.items).toEqual([]);
  });

  it("reads nothing while disabled", async () => {
    const read = vi.fn(async () => answer([]));
    const { result } = renderHook(() => usePagedList({ scope: "wf-1", read, enabled: false }));
    await Promise.resolve();
    expect(read).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });

  it("polls only while a loaded page asks for it and stops once the rows settle", async () => {
    const read = vi.fn(async () => answer([{ id: "a", live: true }]));
    const { result } = renderHook(() =>
      usePagedList({ scope: "wf-1", read, pollWhile: (rows) => rows.some((row) => row.live) }),
    );
    expect(lastPoll().active).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(lastPoll().active).toBe(true);
    expect(lastPoll().isOver({ items: [{ id: "a" }] })).toBe(true);
    act(() => lastPoll().onValue({ items: [{ id: "a" }], meta: answer([]).meta }));
    expect(result.current.items).toEqual([{ id: "a" }]);
    expect(lastPoll().active).toBe(false);
  });

  it("keeps the status of a refused read so the screen can say why", async () => {
    const read = vi.fn(async () => ({ ...answer([], 1, "forbidden"), status: 403 }));
    const { result } = renderHook(() => usePagedList({ scope: "wf-1", read }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.errorStatus).toBe(403);
  });

  it("keeps what the latest page says besides its rows, and polls on it", async () => {
    const read = vi.fn(async (page: number) => ({ ...answer([{ id: `s${page}` }], 2), head: { status: page === 1 ? "running" : "completed" } }));
    const { result } = renderHook(() =>
      usePagedList<Row, { status: string }>({
        scope: "run-1",
        read,
        accumulate: true,
        pollWhile: (_rows, head) => head?.status === "running",
      }),
    );
    await waitFor(() => expect(result.current.head).toEqual({ status: "running" }));
    expect(lastPoll().active).toBe(true);
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.head).toEqual({ status: "completed" }));
    expect(lastPoll().active).toBe(false);
  });

  it("merges a polled page into the rows already loaded when it loads more, updating rows in place", async () => {
    const read = vi.fn(async (page: number) => answer(page === 1 ? [{ id: "a" }, { id: "b" }] : [{ id: "c", live: true }], 2));
    const { result } = renderHook(() =>
      usePagedList({ scope: "wf-1", read, accumulate: true, pollWhile: (rows) => rows.some((row) => row.live) }),
    );
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.items).toHaveLength(3));
    act(() => lastPoll().onValue({ items: [{ id: "c" }, { id: "d" }], meta: answer([], 3).meta }));
    expect(result.current.items).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]);
    expect(result.current.hasMore).toBe(true);
  });

  it("starts over from the first page when the scope changes while it loads more", async () => {
    const read = vi.fn(async (page: number) => answer([{ id: `p${page}` }], 2));
    const { result, rerender } = renderHook(({ scope }) => usePagedList({ scope, read, accumulate: true }), {
      initialProps: { scope: "run-1|0" },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    rerender({ scope: "run-1|1" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.page).toBe(1);
    expect(result.current.items).toEqual([{ id: "p1" }]);
  });

  it("keeps the loaded rows and what they came with when a later page fails", async () => {
    const read = vi.fn(async (page: number) =>
      page === 1 ? { ...answer([{ id: "a" }], 2), head: { status: "completed" } } : { ...answer([], 1, "down"), status: 500 },
    );
    const { result } = renderHook(() => usePagedList<Row, { status: string }>({ scope: "run-1", read, accumulate: true }));
    await waitFor(() => expect(result.current.head).toEqual({ status: "completed" }));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.items).toEqual([{ id: "a" }]);
    expect(result.current.head).toEqual({ status: "completed" });
  });

  it("never polls while paused", async () => {
    const read = vi.fn(async () => answer([{ id: "a", live: true }]));
    const { result } = renderHook(() =>
      usePagedList({ scope: "wf-1", read, pollWhile: (rows) => rows.some((row) => row.live), pollPaused: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(lastPoll().active).toBe(false);
  });
});
