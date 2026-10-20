import { act, renderHook } from "@testing-library/react";
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";

import { useUndoRedo } from "./use-undo-redo";

const before: Node[] = [{ id: "n1", position: { x: 0, y: 0 }, data: {} }];
const beforeEdges: Edge[] = [{ id: "e1", source: "n1", target: "n2" }];

function history() {
  const setNodes = vi.fn();
  const setEdges = vi.fn();
  const { result } = renderHook(() => useUndoRedo(setNodes, setEdges));
  return { result, setNodes, setEdges };
}

describe("useUndoRedo", () => {
  it("takes one undo step when one deletion removes nodes and edges, which snapshots twice before the state changes", () => {
    const { result, setNodes } = history();
    act(() => result.current.syncCurrent(before, beforeEdges));
    act(() => {
      result.current.takeSnapshot();
      result.current.takeSnapshot();
    });
    act(() => result.current.syncCurrent([], []));
    act(() => result.current.undo());
    expect(setNodes).toHaveBeenLastCalledWith([expect.objectContaining({ id: "n1" })]);
    expect(result.current.canUndo()).toBe(false);
  });

  it("keeps one step per change once the state has moved on", () => {
    const { result } = history();
    act(() => result.current.syncCurrent(before, beforeEdges));
    act(() => result.current.takeSnapshot());
    act(() => result.current.syncCurrent([], beforeEdges));
    act(() => result.current.takeSnapshot());
    act(() => result.current.syncCurrent([], []));
    act(() => result.current.undo());
    expect(result.current.canUndo()).toBe(true);
  });
});
