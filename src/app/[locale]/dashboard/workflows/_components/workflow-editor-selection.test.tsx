import type { ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { initialSimSession } from "@/lib/workflows/sim-session";
import type { NodeDefinition, Workflow } from "@/lib/workflows/types";

const stubs = vi.hoisted(() => ({
  simulation: null as unknown,
  persistence: null as unknown,
  alerts: { alerts: [], failed: false, reload: () => {} },
  lint: { issues: [], valid: true, linting: false },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/hooks/use-settled-permission", () => ({
  useSettledPermission: () => true,
}));

vi.mock("@/hooks/use-workflow-simulation", () => ({
  useWorkflowSimulation: () => stubs.simulation,
}));

vi.mock("@/app/actions/workflows", () => ({
  getWorkflowVersionAction: vi.fn(async () => ({ version: null })),
  resolveHandlesAction: vi.fn(async () => ({ handles: {} })),
  getNodeVariablesAction: vi.fn(async () => ({ catalog: { variables: [], unreadable: 0 } })),
  getWorkflowChoiceStatsAction: vi.fn(async () => ({ status: "unreadable" })),
}));

vi.mock("./use-runtime-alerts", () => ({
  useRuntimeAlerts: () => stubs.alerts,
}));

vi.mock("./use-workflow-lint", () => ({
  useWorkflowLint: () => stubs.lint,
}));

vi.mock("./use-workflow-persistence", () => ({
  useWorkflowPersistence: () => stubs.persistence,
}));

vi.mock("./workflow-node", async (importOriginal) => {
  const original = await importOriginal<typeof import("./workflow-node")>();
  const StubNode = ({ data }: { data: { label?: string } }) => <div>{data.label}</div>;
  return { ...original, WorkflowNode: StubNode, GroupNode: StubNode };
});

vi.mock("./editor-header", () => ({
  EditorHeader: (props: {
    onRuntimeFix: (fix: { kind: "open_node"; nodeId: string }) => void;
    onFocusNode: (nodeId: string) => void;
    onEntryFix: (fix: { kind: "open_node"; nodeId: string }) => void;
  }) => (
    <div>
      <button type="button" onClick={() => props.onRuntimeFix({ kind: "open_node", nodeId: "n2" })}>
        alert open node
      </button>
      <button type="button" onClick={() => props.onFocusNode("n2")}>
        lint issue
      </button>
      <button type="button" onClick={() => props.onEntryFix({ kind: "open_node", nodeId: "n2" })}>
        entry point fix
      </button>
    </div>
  ),
}));

vi.mock("./editor-side-panel", () => ({
  EditorSidePanel: (props: {
    onFocusNode: (nodeId: string) => void;
    onTestStep: (nodeId: string, seed: { id: string; valueFor: (key: string) => unknown }) => void;
  }) => (
    <div>
      <button type="button" onClick={() => props.onFocusNode("n2")}>
        run step
      </button>
      <button type="button" onClick={() => props.onTestStep("n2", { id: "seed", valueFor: () => undefined })}>
        test step with data
      </button>
    </div>
  ),
}));

vi.mock("./editor-right-slot", () => ({
  EditorRightSlot: () => null,
}));

vi.mock("./draft-conflict-dialog", () => ({
  DraftConflictDialog: () => null,
}));

vi.mock("./node-config-panel", async () => {
  const { useEffect } = await import("react");
  function StubConfigPanel({ node, onClose }: { node: { id: string }; onClose: () => void }) {
    useEffect(() => {
      const close = (event: KeyboardEvent) => {
        if (event.key === "Escape") onClose();
      };
      window.addEventListener("keydown", close);
      return () => window.removeEventListener("keydown", close);
    }, [onClose]);
    return (
      <div role="dialog" aria-label={`config ${node.id}`}>
        <button type="button" onClick={onClose}>
          fechar
        </button>
      </div>
    );
  }
  return { NodeConfigPanel: StubConfigPanel };
});

import { WorkflowEditor } from "./workflow-editor";

const DEFINITIONS = [
  {
    type: "action_send_message",
    category: "action",
    label: "Enviar mensagem",
    description: "",
    icon: "ChatText",
    defaultConfig: {},
    configSchema: [],
    scopes: ["shared"],
  },
] as unknown as NodeDefinition[];

function workflow(): Workflow {
  return {
    id: "wf-1",
    workspaceId: "ws-1",
    name: "Fluxo",
    description: "",
    status: "draft",
    type: "messages",
    graph: {
      nodes: [
        { id: "n1", type: "action_send_message", position: { x: 0, y: 0 }, config: { display_name: "Primeiro" } },
        { id: "n2", type: "action_send_message", position: { x: 300, y: 0 }, config: { display_name: "Segundo" } },
      ],
      edges: [],
    },
  } as unknown as Workflow;
}

function renderEditor(props: Partial<ComponentProps<typeof WorkflowEditor>> = {}) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      <WorkflowEditor workflow={workflow()} definitions={DEFINITIONS} mode="edit" initialHandles={{}} {...props} />
    </NextIntlClientProvider>,
  );
}

function canvasNode(nodeId: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`);
  if (!element) throw new Error(`node ${nodeId} is not on the canvas`);
  return element;
}

function isSelected(nodeId: string): boolean {
  return canvasNode(nodeId).classList.contains("selected");
}

function mouse(type: string, target: EventTarget, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 });
  Object.defineProperty(event, "view", { value: window });
  act(() => {
    target.dispatchEvent(event);
  });
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 5)));
}

function configDialog() {
  return screen.queryByRole("dialog", { name: /^config / });
}

const HINT = "Clique duas vezes para configurar";
const HINT_STORAGE_KEY = "vozko.workflows.selectHint.dismissed";

beforeEach(() => {
  stubs.simulation = {
    ...initialSimSession(),
    pendingRealCalls: [],
    connect: vi.fn(),
    start: vi.fn(),
    sendReply: vi.fn(),
    sendKey: vi.fn(),
    cancel: vi.fn(),
    step: vi.fn(),
    resume: vi.fn(),
    runUntil: vi.fn(),
    setBreakpoints: vi.fn(),
    confirmRealCalls: vi.fn(),
    skipRealCalls: vi.fn(),
    dismissRealCalls: vi.fn(),
    retryWithRealCalls: vi.fn(),
    reset: vi.fn(),
  };
  stubs.persistence = {
    publishIssues: [],
    unsaved: false,
    saveNow: vi.fn(),
    handlePublish: vi.fn(),
    handleResume: vi.fn(),
    handlePause: vi.fn(),
    handleDelete: vi.fn(),
    handleRestoreVersion: vi.fn(),
    pinRunStep: vi.fn(),
    alertsRequest: null,
    saveStatus: { kind: "saved" },
    retrySave: vi.fn(),
    showConflict: vi.fn(),
    publishing: false,
    conflictOpen: false,
    canOverwrite: false,
    reloadDraft: vi.fn(),
    overwriteDraft: vi.fn(),
    dismissConflict: vi.fn(),
  };
  window.localStorage.removeItem(HINT_STORAGE_KEY);
});

afterEach(() => {
  window.localStorage.removeItem(HINT_STORAGE_KEY);
});

describe("WorkflowEditor select versus configure", () => {
  it("selects a node on a single click without opening its configuration", () => {
    renderEditor();
    fireEvent.click(canvasNode("n1"));
    expect(isSelected("n1")).toBe(true);
    expect(configDialog()).toBeNull();
  });

  it("opens the configuration on a double click", () => {
    renderEditor();
    fireEvent.click(canvasNode("n1"));
    fireEvent.doubleClick(canvasNode("n1"));
    expect(screen.getByRole("dialog", { name: "config n1" })).toBeInTheDocument();
  });

  it("opens the configuration on a double tap, since touch screens have no reliable double click", () => {
    renderEditor();
    const tap = () => fireEvent(canvasNode("n1"), new PointerEvent("click", { bubbles: true, pointerType: "touch" }));
    tap();
    expect(configDialog()).toBeNull();
    tap();
    expect(screen.getByRole("dialog", { name: "config n1" })).toBeInTheDocument();
  });

  it("opens the focused node with Enter and Escape closes it and gives focus back to the node", () => {
    renderEditor();
    const node = canvasNode("n1");
    node.focus();
    fireEvent.keyDown(node, { key: "Enter" });
    expect(screen.getByRole("dialog", { name: "config n1" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(configDialog()).toBeNull();
    expect(document.activeElement).toBe(canvasNode("n1"));
  });

  it("opens the single selected node with Enter when nothing else has focus", () => {
    renderEditor();
    fireEvent.click(canvasNode("n2"));
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(screen.getByRole("dialog", { name: "config n2" })).toBeInTheDocument();
  });

  it("clears the selection when the empty canvas is clicked", () => {
    const { container } = renderEditor();
    fireEvent.click(canvasNode("n1"));
    expect(isSelected("n1")).toBe(true);
    const pane = container.querySelector<HTMLElement>(".react-flow__pane");
    if (!pane) throw new Error("pane missing");
    fireEvent.click(pane);
    expect(isSelected("n1")).toBe(false);
    expect(configDialog()).toBeNull();
  });

  it("never opens the configuration when a node is dragged", async () => {
    renderEditor();
    const node = canvasNode("n1");
    const before = node.style.transform;
    mouse("mousedown", node, 10, 10);
    mouse("mousemove", window, 60, 40);
    mouse("mousemove", window, 90, 70);
    mouse("mouseup", window, 90, 70);
    fireEvent.click(node);
    expect(canvasNode("n1").style.transform).not.toBe(before);
    expect(configDialog()).toBeNull();
    await settle();
  });

  it("offers Configurar first in the node menu and opens the configuration from it", () => {
    renderEditor();
    fireEvent.contextMenu(canvasNode("n1"), { clientX: 20, clientY: 20 });
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveTextContent("Configurar");
    fireEvent.click(items[0]);
    expect(screen.getByRole("dialog", { name: "config n1" })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens the configuration from the ?node= deep link", () => {
    renderEditor({ initialNodeId: "n2" });
    expect(screen.getByRole("dialog", { name: "config n2" })).toBeInTheDocument();
  });

  it("opens the configuration from the alert fix, the lint issue, the entry point fix and the test with data action", () => {
    renderEditor();
    for (const action of ["alert open node", "lint issue", "entry point fix", "test step with data"]) {
      fireEvent.click(screen.getByRole("button", { name: action }));
      expect(screen.getByRole("dialog", { name: "config n2" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "fechar" }));
      expect(configDialog()).toBeNull();
    }
  });

  it("selects the node of a run step without opening its configuration", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "run step" }));
    expect(isSelected("n2")).toBe(true);
    expect(configDialog()).toBeNull();
  });

  it("selects the only search match without opening its configuration, so typing in the search keeps focus", () => {
    renderEditor();
    fireEvent.keyDown(window, { key: "f", ctrlKey: true });
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar nós" }), { target: { value: "Segundo" } });
    expect(isSelected("n2")).toBe(true);
    expect(configDialog()).toBeNull();
  });

  it("deletes the selected node with the Delete key", async () => {
    renderEditor();
    fireEvent.click(canvasNode("n1"));
    fireEvent.keyDown(document.body, { key: "Delete" });
    fireEvent.keyUp(document.body, { key: "Delete" });
    await act(async () => {});
    expect(document.querySelector('.react-flow__node[data-id="n1"]')).toBeNull();
    expect(document.querySelector('.react-flow__node[data-id="n2"]')).not.toBeNull();
  });

  it("deletes every selected node with the toolbar delete button", async () => {
    renderEditor();
    await settle();
    fireEvent.keyDown(window, { key: "Shift" });
    fireEvent.click(canvasNode("n1"));
    fireEvent.click(canvasNode("n2"));
    fireEvent.keyUp(window, { key: "Shift" });
    fireEvent.click(screen.getByRole("button", { name: "Excluir seleção" }));
    await settle();
    expect(document.querySelector(".react-flow__node")).toBeNull();
  });

  it("adds to the selection with shift click", () => {
    renderEditor();
    fireEvent.click(canvasNode("n1"));
    fireEvent.keyDown(window, { key: "Shift" });
    fireEvent.click(canvasNode("n2"));
    fireEvent.keyUp(window, { key: "Shift" });
    expect(isSelected("n1")).toBe(true);
    expect(isSelected("n2")).toBe(true);
    expect(configDialog()).toBeNull();
  });

  it("hints at double click while one node is selected and remembers when the hint is dismissed", () => {
    const first = renderEditor();
    expect(screen.queryByText(HINT)).toBeNull();
    fireEvent.click(canvasNode("n1"));
    expect(screen.getByText(HINT)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Shift" });
    fireEvent.click(canvasNode("n2"));
    fireEvent.keyUp(window, { key: "Shift" });
    expect(screen.queryByText(HINT)).toBeNull();
    const pane = first.container.querySelector<HTMLElement>(".react-flow__pane");
    if (!pane) throw new Error("pane missing");
    fireEvent.click(pane);
    fireEvent.click(canvasNode("n2"));
    fireEvent.click(screen.getByRole("button", { name: "Dispensar dica" }));
    expect(screen.queryByText(HINT)).toBeNull();
    first.unmount();

    renderEditor();
    fireEvent.click(canvasNode("n1"));
    expect(screen.queryByText(HINT)).toBeNull();
  });

  function canvasNodeIds(): string[] {
    return [...document.querySelectorAll<HTMLElement>(".react-flow__node")].map((element) => element.dataset.id ?? "").sort();
  }

  function selectBoth() {
    fireEvent.keyDown(window, { key: "Shift" });
    fireEvent.click(canvasNode("n1"));
    fireEvent.click(canvasNode("n2"));
    fireEvent.keyUp(window, { key: "Shift" });
  }

  it("copies every selected node with Ctrl+C and pastes them with fresh ids, undone in one step", async () => {
    renderEditor();
    await settle();
    selectBoth();
    fireEvent.keyDown(document.body, { key: "c", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "v", ctrlKey: true });
    await settle();
    expect(canvasNodeIds()).toEqual(["n1", "n2", "n3", "n4"]);
    expect(isSelected("n3") && isSelected("n4")).toBe(true);
    expect(isSelected("n1") || isSelected("n2")).toBe(false);
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    await settle();
    expect(canvasNodeIds()).toEqual(["n1", "n2"]);
  });

  it("copies with Cmd+C and pastes with Cmd+V too", async () => {
    renderEditor();
    await settle();
    selectBoth();
    fireEvent.keyDown(document.body, { key: "c", metaKey: true });
    fireEvent.keyDown(document.body, { key: "v", metaKey: true });
    await settle();
    expect(canvasNodeIds()).toEqual(["n1", "n2", "n3", "n4"]);
  });

  it("undoes a toolbar delete of several nodes in one step", async () => {
    renderEditor();
    await settle();
    selectBoth();
    fireEvent.click(screen.getByRole("button", { name: "Excluir seleção" }));
    await settle();
    expect(canvasNodeIds()).toEqual([]);
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    await settle();
    expect(canvasNodeIds()).toEqual(["n1", "n2"]);
  });
});
