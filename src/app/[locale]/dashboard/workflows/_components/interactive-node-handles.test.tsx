import { render, screen } from "@testing-library/react";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import type { HandleDefinition } from "@/lib/workflows/types";

import { createNodeDebugStore, NodeDebugContext } from "./node-debug-marks";
import { WorkflowNode, type WorkflowNodeData } from "./workflow-node";

const CATCH_ALLS: HandleDefinition[] = [
  { id: "no_match", label: "Sem correspondência", optional: true },
  { id: "no_reply", label: "Não respondeu", optional: true },
  { id: "send_failed", label: "Falha no envio", optional: true },
];

function renderInteractive(config: Record<string, unknown>, outputs?: HandleDefinition[]) {
  const data: WorkflowNodeData = { nodeType: "action_send_interactive", config, label: "Enviar Opções", outputs };
  const props = { id: "n27", data, selected: false } as unknown as NodeProps;
  return render(
    <ReactFlowProvider initialNodes={[{ id: "n27", position: { x: 0, y: 0 }, data: {} }]}>
      <NodeDebugContext.Provider value={createNodeDebugStore()}>
        <WorkflowNode {...props} />
      </NodeDebugContext.Provider>
    </ReactFlowProvider>,
  );
}

function sourceHandleIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".react-flow__handle.source")).map((el) => el.getAttribute("data-handleid") ?? "");
}

const CAPITALIZED_LIST = {
  interactive_type: "list",
  sections: '[{"Title":"Aulas Aquáticas","Rows":[{"ID":"1","Title":"Horários Aquáticas 🏊‍♀️"},{"ID":"2","Title":"Materiais Aquáticos 🥽"}]}]',
};

describe("the interactive node", () => {
  it("draws its options and handles from the server's handles", () => {
    const { container } = renderInteractive({ interactive_type: "list", sections: "[]" }, [
      { id: "1", label: "Horários Aquáticas 🏊‍♀️" },
      { id: "2", label: "Materiais Aquáticos 🥽" },
      ...CATCH_ALLS,
    ]);

    expect(sourceHandleIds(container)).toEqual(["1", "2", "no_match", "no_reply", "send_failed"]);
    expect(screen.getByText("Horários Aquáticas 🏊‍♀️")).toBeInTheDocument();
    expect(screen.getByText("Materiais Aquáticos 🥽")).toBeInTheDocument();
  });

  it("never reads options out of a capitalized config on its own", () => {
    const { container } = renderInteractive(CAPITALIZED_LIST, CATCH_ALLS);

    expect(sourceHandleIds(container)).toEqual(["no_match", "no_reply", "send_failed"]);
    expect(screen.queryByText("Horários Aquáticas 🏊‍♀️")).toBeNull();
  });
});
