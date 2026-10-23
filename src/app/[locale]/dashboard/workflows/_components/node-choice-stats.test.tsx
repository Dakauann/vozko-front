import { act, render, screen } from "@testing-library/react";
import { ReactFlowProvider, useStoreApi, type Node, type NodeProps } from "@xyflow/react";
import { NextIntlClientProvider } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { ChatCircleDots } from "@/components/icons";
import messages from "@/i18n/messages/pt.json";
import { readWorkflowChoiceStats } from "@/lib/choice-stats/stats";
import type { HandleDefinition } from "@/lib/workflows/types";

import { ChoiceStatsContext, createChoiceStatsStore, settleChoiceStats, type ChoiceStatsStore } from "./choice-stats-store";
import { InteractiveNodeShell } from "./message-node-primitives";
import { WorkflowNode, type WorkflowNodeData } from "./workflow-node";

const MENU_STATS = {
  sends: 1742,
  clickedPrompts: 1394,
  clickRate: 8003,
  freeText: { count: 87, rate: 499 },
  options: [
    { optionId: "sim", shown: 1742, clicks: 244, ctr: 1400 },
    { optionId: "nao", shown: 0, clicks: 0, ctr: 0 },
  ],
};

function storeWith(nodes: { nodeId: string }[]): ChoiceStatsStore {
  const store = createChoiceStatsStore();
  const stats = readWorkflowChoiceStats({ from: "2026-09-23", to: "2026-10-22", timezone: "America/Sao_Paulo", version: null, nodes })!;
  store.set(settleChoiceStats(store.get(), { status: "ready", stats }));
  return store;
}

function Providers({ store, nodes, children }: { store: ChoiceStatsStore; nodes: Node[]; children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={messages} timeZone="America/Sao_Paulo">
      <ChoiceStatsContext.Provider value={store}>
        <ReactFlowProvider initialNodes={nodes}>{children}</ReactFlowProvider>
      </ChoiceStatsContext.Provider>
    </NextIntlClientProvider>
  );
}

const OUTPUTS: HandleDefinition[] = [
  { id: "sim", label: "Sim" },
  { id: "nao", label: "Não" },
  { id: "no_match", label: "Sem correspondência", optional: true },
];

function renderMenu(store: ChoiceStatsStore, nodeType = "action_send_interactive") {
  const data: WorkflowNodeData = { nodeType: nodeType as WorkflowNodeData["nodeType"], config: { interactive_type: "list" }, label: "Menu", outputs: OUTPUTS };
  const props = { id: "menu", data, selected: false } as unknown as NodeProps;
  return render(
    <Providers store={store} nodes={[{ id: "menu", position: { x: 0, y: 0 }, data: {} }]}>
      <WorkflowNode {...props} />
    </Providers>,
  );
}

describe("choice stats on the full node card", () => {
  it("shows sends and click rate in the header and the CTR beside each option row", () => {
    renderMenu(storeWith([{ nodeId: "menu", ...MENU_STATS }]));
    expect(screen.getByText("1.742 envios")).toBeInTheDocument();
    expect(screen.getByText("80% cliques")).toBeInTheDocument();
    const sim = document.querySelector('[data-option-id="sim"]')!;
    expect(sim).toHaveTextContent("CTR 14%");
  });

  it("shows n/d for an option nobody saw instead of a misleading 0%", () => {
    renderMenu(storeWith([{ nodeId: "menu", ...MENU_STATS }]));
    expect(document.querySelector('[data-option-id="nao"]')).toHaveTextContent("CTR n/d");
  });

  it("shows n/d sends on a choice node the period never sent", () => {
    renderMenu(storeWith([]));
    expect(screen.getByText("n/d envios")).toBeInTheDocument();
    expect(screen.queryByText(/CTR/)).toBeNull();
  });

  it("leaves the card as it was while no stats are loaded", () => {
    renderMenu(createChoiceStatsStore());
    expect(screen.queryByText(/envios/)).toBeNull();
  });

  it("counts a template node's sends too", () => {
    const data: WorkflowNodeData = { nodeType: "action_send_template", config: {}, label: "Template" };
    const props = { id: "tpl", data, selected: false } as unknown as NodeProps;
    render(
      <Providers store={storeWith([{ nodeId: "tpl", ...MENU_STATS }])} nodes={[{ id: "tpl", position: { x: 0, y: 0 }, data: {} }]}>
        <WorkflowNode {...props} />
      </Providers>,
    );
    expect(screen.getByText("1.742 envios")).toBeInTheDocument();
  });
});

const MEASURED: Node = { id: "menu", position: { x: 0, y: 0 }, data: {}, measured: { width: 232, height: 260 } };
const HANDLES = [{ id: "sim", type: "source", position: "right", x: 227, y: 180, width: 9, height: 9 }];

let zoomTo: (zoom: number) => void = () => undefined;

function ZoomControl() {
  const store = useStoreApi();
  useEffect(() => {
    zoomTo = (zoom) => {
      const node = store.getState().nodeLookup.get("menu");
      if (node) node.internals.handleBounds = { source: HANDLES, target: [] } as unknown as typeof node.internals.handleBounds;
      store.setState({ transform: [0, 0, zoom] });
    };
  }, [store]);
  return null;
}

function ShellWithStats() {
  return (
    <Providers store={storeWith([{ nodeId: "menu", ...MENU_STATS }])} nodes={[MEASURED]}>
      <ZoomControl />
      <ShellReadingStats />
    </Providers>
  );
}

function ShellReadingStats() {
  return (
    <InteractiveNodeShell id="menu" label="Menu" icon={ChatCircleDots} iconColor="#000" width={232} branches={[{ id: "sim", label: "Sim" }]} choiceNode>
      {() => <span>prévia completa</span>}
    </InteractiveNodeShell>
  );
}

describe("choice stats by detail tier", () => {
  it("keeps only the header numbers on the simplified card", () => {
    render(<ShellWithStats />);
    act(() => zoomTo(0.45));
    expect(screen.getByText("1.742 envios")).toBeInTheDocument();
    expect(screen.queryByText(/CTR/)).toBeNull();
  });

  it("drops the numbers when zoomed far out", () => {
    render(<ShellWithStats />);
    act(() => zoomTo(0.2));
    expect(screen.queryByText(/envios/)).toBeNull();
  });
});
