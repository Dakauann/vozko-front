import { act, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { Code } from "@/components/icons";

import { InteractiveNodeShell } from "./message-node-primitives";
import { createNodeDebugStore, NodeDebugContext, type NodeDebugStore } from "./node-debug-marks";

function renderShell(store: NodeDebugStore, props: { pinned?: boolean } = {}) {
  const wrap = (children: ReactNode) => (
    <ReactFlowProvider>
      <NodeDebugContext.Provider value={store}>{children}</NodeDebugContext.Provider>
    </ReactFlowProvider>
  );
  return render(
    wrap(
      <InteractiveNodeShell id="n1" label="Login" icon={Code} iconColor="#000" width={200} branches={[]} {...props}>
        {() => null}
      </InteractiveNodeShell>,
    ),
  );
}

describe("InteractiveNodeShell debug marks", () => {
  it("draws the breakpoint dot and the real call chip from the editor's debug marks", () => {
    const store = createNodeDebugStore();
    renderShell(store);
    expect(screen.queryByRole("img", { name: "Ponto de parada" })).toBeNull();
    expect(screen.queryByText("chamada real")).toBeNull();

    act(() => store.set({ breakpoints: new Set(["n1"]), realCalls: new Set(["n1"]), pausedNodeId: null, activeNodeId: null }));
    expect(screen.getByRole("img", { name: "Ponto de parada" })).toBeInTheDocument();
    expect(screen.getByText("chamada real")).toBeInTheDocument();
  });

  it("shows the pin mark for a pinned node", () => {
    renderShell(createNodeDebugStore(), { pinned: true });
    expect(screen.getByLabelText("Saída fixada")).toBeInTheDocument();
  });
});
