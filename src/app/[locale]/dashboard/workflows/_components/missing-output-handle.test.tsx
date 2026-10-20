import { render, screen } from "@testing-library/react";
import { ReactFlowProvider, type Edge, type Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { Code } from "@/components/icons";

import { InteractiveNodeShell, type ShellBranch } from "./message-node-primitives";
import { createNodeDebugStore, NodeDebugContext } from "./node-debug-marks";

const MISSING_TOOLTIP = "Conexão de uma saída que não existe mais";

function renderShell(branches: ShellBranch[], edges: Edge[]) {
  const nodes: Node[] = [
    { id: "n27", position: { x: 0, y: 0 }, data: {} },
    { id: "n44", position: { x: 300, y: 0 }, data: {} },
  ];
  return render(
    <ReactFlowProvider initialNodes={nodes} initialEdges={edges}>
      <NodeDebugContext.Provider value={createNodeDebugStore()}>
        <InteractiveNodeShell id="n27" label="Opções" icon={Code} iconColor="#000" width={232} branches={branches}>
          {({ registerRow }) => (
            <>
              {branches.map((b) => (
                <div key={b.id} ref={(el) => registerRow(el, b.id)} />
              ))}
            </>
          )}
        </InteractiveNodeShell>
      </NodeDebugContext.Provider>
    </ReactFlowProvider>,
  );
}

function sourceHandleIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".react-flow__handle.source")).map((el) => el.getAttribute("data-handleid") ?? "");
}

describe("an edge whose output no longer exists", () => {
  it("still has a handle to leave from, marked as a missing output", () => {
    const { container } = renderShell(
      [{ id: "1" }],
      [
        { id: "e1", source: "n27", target: "n44", sourceHandle: "1" },
        { id: "e2", source: "n27", target: "n44", sourceHandle: "2" },
      ],
    );

    expect(sourceHandleIds(container)).toEqual(["1", "2"]);
    const missing = container.querySelector('.react-flow__handle[data-handleid="2"]');
    expect(missing?.getAttribute("title")).toBe(MISSING_TOOLTIP);
    expect(screen.getAllByTitle(MISSING_TOOLTIP).length).toBeGreaterThan(0);
  });

  it("adds nothing when every edge leaves a current output", () => {
    const { container } = renderShell([{ id: "1" }, { id: "2" }], [{ id: "e1", source: "n27", target: "n44", sourceHandle: "2" }]);

    expect(sourceHandleIds(container)).toEqual(["1", "2"]);
    expect(screen.queryByTitle(MISSING_TOOLTIP)).toBeNull();
  });
});
