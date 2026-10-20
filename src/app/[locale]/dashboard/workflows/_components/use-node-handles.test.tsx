import { act, renderHook } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HandleDefinition, NodeDefinition } from "@/lib/workflows/types";

import type { OutputLabels } from "./editor-flow";
import { useNodeHandles } from "./use-node-handles";

const resolveHandlesAction = vi.fn();
const toastError = vi.fn();

vi.mock("@/app/actions/workflows", () => ({ resolveHandlesAction: (...args: unknown[]) => resolveHandlesAction(...args) }));
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

const LABELS: OutputLabels = {
  defaultPath: "Padrão",
  textResponse: "Resposta",
  noMatch: "Sem correspondência",
  error: "Erro",
  form: { completed: "Respondeu", no_reply: "Não respondeu", send_failed: "Falha no envio" },
};

const DEFINITIONS = [{ type: "condition_text_match", dynamicHandles: true, outputs: [] }] as unknown as NodeDefinition[];
const DEF_MAP = new Map(DEFINITIONS.map((d) => [d.type as string, d]));

function textMatch(id: string, value: string): Node {
  return { id, position: { x: 0, y: 0 }, data: { nodeType: "condition_text_match", config: { cases: [{ value }] } } };
}

function handlesFor(value: string): HandleDefinition[] {
  return [{ id: value, label: value }, { id: "default", label: "Padrão", optional: true }];
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function renderHandles(initialNodes: Node[], initialHandles: Record<string, HandleDefinition[]>) {
  const latestNodesRef = { current: initialNodes };
  const view = renderHook(
    ({ nodes }: { nodes: Node[] }) => {
      latestNodesRef.current = nodes;
      return useNodeHandles({
        definitions: DEFINITIONS,
        defMap: DEF_MAP,
        structureNodes: nodes,
        latestNodesRef,
        setNodes: () => undefined,
        outputLabels: LABELS,
        initialHandles,
      });
    },
    { initialProps: { nodes: initialNodes } },
  );
  return view;
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}

describe("useNodeHandles", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resolveHandlesAction.mockReset();
    toastError.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("asks nothing for the handles the workflow was opened with, and only the edited node afterwards", async () => {
    resolveHandlesAction.mockResolvedValue({ handles: { b: handlesFor("novo") } });
    const nodes = [textMatch("a", "sim"), textMatch("b", "nao")];
    const view = renderHandles(nodes, { a: handlesFor("sim"), b: handlesFor("nao") });

    await settle();
    expect(resolveHandlesAction).not.toHaveBeenCalled();

    view.rerender({ nodes: [nodes[0], textMatch("b", "novo")] });
    await settle();

    expect(resolveHandlesAction).toHaveBeenCalledTimes(1);
    expect(resolveHandlesAction.mock.calls[0][0].map((n: { id: string }) => n.id)).toEqual(["b"]);
    expect(view.result.current).toEqual({ a: handlesFor("sim"), b: handlesFor("novo") });
  });

  it("drops the handles of a removed node", async () => {
    const nodes = [textMatch("a", "sim"), textMatch("b", "nao")];
    const view = renderHandles(nodes, { a: handlesFor("sim"), b: handlesFor("nao") });

    view.rerender({ nodes: [nodes[0]] });
    await settle();

    expect(resolveHandlesAction).not.toHaveBeenCalled();
    expect(view.result.current).toEqual({ a: handlesFor("sim") });
  });

  it("ignores an answer that arrives after a newer request", async () => {
    const slow = deferred<{ handles: Record<string, HandleDefinition[]> }>();
    resolveHandlesAction.mockReturnValueOnce(slow.promise).mockResolvedValueOnce({ handles: { a: handlesFor("dois") } });
    const view = renderHandles([textMatch("a", "sim")], { a: handlesFor("sim") });

    view.rerender({ nodes: [textMatch("a", "um")] });
    await settle();
    view.rerender({ nodes: [textMatch("a", "dois")] });
    await settle();
    await act(async () => {
      slow.resolve({ handles: { a: handlesFor("um") } });
      await Promise.resolve();
    });

    expect(view.result.current).toEqual({ a: handlesFor("dois") });
  });

  it("keeps the last good handles and says so when a refresh fails", async () => {
    resolveHandlesAction.mockResolvedValue({ handles: {}, error: "falhou" });
    const view = renderHandles([textMatch("a", "sim")], { a: handlesFor("sim") });

    view.rerender({ nodes: [textMatch("a", "outro")] });
    await settle();

    expect(view.result.current).toEqual({ a: handlesFor("sim") });
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
