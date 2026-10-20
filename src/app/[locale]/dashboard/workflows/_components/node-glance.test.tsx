import { act, render, screen } from "@testing-library/react";
import { ReactFlowProvider, useStoreApi, type Node } from "@xyflow/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { Image } from "@/components/icons";

import { InteractiveNodeShell, type ShellBranch } from "./message-node-primitives";

const MEASURED: Node = { id: "n1", position: { x: 0, y: 0 }, data: {}, measured: { width: 232, height: 260 } };
const MEASURED_HANDLES = [
  { id: "planos", type: "source", position: "right", x: 227, y: 180, width: 9, height: 9 },
  { id: "no_reply", type: "source", position: "right", x: 227, y: 220, width: 9, height: 9 },
];

let zoomTo: (zoom: number) => void = () => undefined;

function ZoomControl({ handles }: { handles: boolean }) {
  const store = useStoreApi();
  useEffect(() => {
    zoomTo = (zoom) => {
      const node = store.getState().nodeLookup.get("n1");
      if (node && handles) node.internals.handleBounds = { source: MEASURED_HANDLES, target: [] } as unknown as typeof node.internals.handleBounds;
      store.setState({ transform: [0, 0, zoom] });
    };
  }, [store, handles]);
  return null;
}

function renderMediaNode(branches: ShellBranch[] = []) {
  return render(
    <ReactFlowProvider initialNodes={[MEASURED]}>
      <ZoomControl handles={branches.length > 0} />
      <InteractiveNodeShell
        id="n1"
        label="Enviar mídia"
        icon={Image}
        iconColor="#000"
        width={232}
        branches={branches}
        glance={<span>miniatura da tabela</span>}
        summary={{ text: "Tabela de outubro\nConfira os valores" }}
      >
        {() => <span>prévia completa</span>}
      </InteractiveNodeShell>
    </ReactFlowProvider>,
  );
}

describe("InteractiveNodeShell detail tiers", () => {
  it("keeps the node's media and its caption on the simplified card", () => {
    renderMediaNode();
    act(() => zoomTo(0.45));
    expect(screen.getByText("miniatura da tabela")).toBeInTheDocument();
    expect(screen.getByText(/Tabela de outubro\s+Confira os valores/)).toBeInTheDocument();
    expect(screen.queryByText("prévia completa")).toBeNull();
  });

  it("keeps the media and one summary line when zoomed far out", () => {
    renderMediaNode();
    act(() => zoomTo(0.2));
    expect(screen.getByText("miniatura da tabela")).toBeInTheDocument();
    expect(screen.getByText("Tabela de outubro")).toBeInTheDocument();
    expect(screen.queryByText(/Confira os valores/)).toBeNull();
  });

  it("draws the full preview again at readable zoom", () => {
    renderMediaNode();
    act(() => zoomTo(0.3));
    act(() => zoomTo(1));
    expect(screen.getByText("prévia completa")).toBeInTheDocument();
    expect(screen.queryByText("miniatura da tabela")).toBeNull();
  });

  it("labels each branch at the height its handle was measured, so labels and edges stay together", () => {
    renderMediaNode([
      { id: "planos", label: "Ver planos", required: true },
      { id: "no_reply", label: "Não respondeu" },
    ]);
    act(() => zoomTo(0.45));
    const label = screen.getByText("Ver planos");
    expect(label.closest("[data-branch-label]")).toHaveStyle({ top: `${180 + 9 / 2}px` });
    expect(screen.getByText("Não respondeu")).toBeInTheDocument();
    act(() => zoomTo(0.2));
    expect(screen.queryByText("Ver planos")).toBeNull();
    expect(document.querySelector('[data-handleid="planos"]')).toHaveStyle({ top: `${180 + 9 / 2}px` });
  });
});
