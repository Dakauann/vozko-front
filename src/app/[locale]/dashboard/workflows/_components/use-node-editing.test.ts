import { renderHook } from "@testing-library/react";
import type { Edge, Node, ReactFlowInstance } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";

import type { OutputLabels } from "./editor-flow";
import { useNodeEditing } from "./use-node-editing";

const OUTPUT_LABELS: OutputLabels = {
  defaultPath: "Seguir",
  textResponse: "Resposta",
  noMatch: "Sem correspondência",
  error: "Erro",
  form: { completed: "Respondido", no_reply: "Sem resposta", send_failed: "Falha no envio" },
};

function editing(nodes: Node[], edges: Edge[]) {
  const deleteElements = vi.fn(async () => ({ deletedNodes: [], deletedEdges: [] }));
  const instance = { getNodes: () => nodes, getEdges: () => edges, deleteElements } as unknown as ReactFlowInstance;
  const { result } = renderHook(() =>
    useNodeEditing({
      defMap: new Map(),
      outputLabels: OUTPUT_LABELS,
      canAddNodeType: () => true,
      takeSnapshot: vi.fn(),
      setNodes: vi.fn(),
      setEdges: vi.fn(),
      onNodesChange: vi.fn(),
      onEdgesChange: vi.fn(),
      freshNodeId: () => "n9",
      reactFlowInstance: { current: instance },
      latestNodesRef: { current: nodes },
      setConfigNodeId: vi.fn(),
    }),
  );
  return { deleteSelected: result.current.deleteSelected, deleteElements };
}

const node = (id: string, selected: boolean): Node => ({ id, position: { x: 0, y: 0 }, data: {}, selected });
const edge = (id: string, selected: boolean): Edge => ({ id, source: "a", target: "b", selected });

describe("deleteSelected", () => {
  it("deletes the selected nodes and the selected edges in one call, the same deletion the Delete key makes", () => {
    const { deleteSelected, deleteElements } = editing([node("n1", true), node("n2", false)], [edge("e1", true), edge("e2", false)]);
    deleteSelected();
    expect(deleteElements).toHaveBeenCalledTimes(1);
    expect(deleteElements).toHaveBeenCalledWith({ nodes: [expect.objectContaining({ id: "n1" })], edges: [expect.objectContaining({ id: "e1" })] });
  });

  it("deletes a selected edge when no node is selected", () => {
    const { deleteSelected, deleteElements } = editing([node("n1", false)], [edge("e1", true)]);
    deleteSelected();
    expect(deleteElements).toHaveBeenCalledWith({ nodes: [], edges: [expect.objectContaining({ id: "e1" })] });
  });

  it("does nothing when nothing is selected", () => {
    const { deleteSelected, deleteElements } = editing([node("n1", false)], [edge("e1", false)]);
    deleteSelected();
    expect(deleteElements).not.toHaveBeenCalled();
  });
});
