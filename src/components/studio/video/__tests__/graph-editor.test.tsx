import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { keySide } from "@/lib/studio/keyframe-ease";
import { findClip } from "@/lib/studio/timeline";

import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 4000), id: "a" }] }];
  d.tracks[0].clips[0].keyframes = {
    x: [
      { atMs: 1000, value: 0.2, easing: "linear" },
      { atMs: 3000, value: 0.8, easing: "linear" },
    ],
  };
  d.durationMs = 4000;
  return d;
}

function openGraph() {
  const rendered = renderInEditor(doc(), <Timeline />);
  act(() => rendered.editor.commands.enterFocus("a"));
  act(() => rendered.editor.view.setState({ pxPerSecond: 100, snapping: false }));
  fireEvent.click(screen.getByRole("button", { name: "Gráfico" }));
  return rendered;
}

function center(element: Element): { clientX: number; clientY: number } {
  if (element.tagName.toLowerCase() === "circle") return { clientX: Number(element.getAttribute("cx")), clientY: Number(element.getAttribute("cy")) };
  return { clientX: Number(element.getAttribute("x")) + 4, clientY: Number(element.getAttribute("y")) + 4 };
}

describe("graph editor", () => {
  it("opens from the focus strip with a value graph, a legend and a speed graph", { timeout: 15_000 }, () => {
    const { editor } = openGraph();
    expect(screen.getByRole("button", { name: "Gráfico" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("application", { name: "Gráfico de valor" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Propriedades no gráfico" })).toHaveTextContent("Posição X");
    expect(screen.getByLabelText("Quadro-chave de Posição X em 1000 ms")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Velocidade" }));
    expect(screen.getByRole("application", { name: "Gráfico de velocidade" })).toBeInTheDocument();
    expect(editor.view.getState().graphMode).toBe("speed");
    fireEvent.click(screen.getByRole("button", { name: "Gráfico" }));
    expect(screen.queryByRole("application")).toBeNull();
    expect(screen.getByRole("group", { name: "Faixas de quadros-chave" })).toBeInTheDocument();
  });

  it("opens on the selected clip from the shortcut command", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.store.getState().select(["a"]));
    act(() => editor.commands.toggleGraph());
    expect(editor.view.getState().focus?.clipId).toBe("a");
    expect(screen.getByRole("application", { name: "Gráfico de valor" })).toBeInTheDocument();
  });

  it("drags a key in time and value as one undo step", { timeout: 15_000 }, () => {
    const { editor } = openGraph();
    const keys = () => findClip(editor.store.getState().document, "a")!.clip.keyframes?.x ?? [];
    const graph = screen.getByRole("application", { name: "Gráfico de valor" });
    const start = center(screen.getByLabelText("Quadro-chave de Posição X em 1000 ms"));
    fireEvent.pointerDown(graph, { button: 0, pointerId: 1, ...start });
    fireEvent.pointerMove(graph, { pointerId: 1, clientX: start.clientX + 50, clientY: start.clientY - 20 });
    fireEvent.pointerUp(graph, { pointerId: 1, clientX: start.clientX + 50, clientY: start.clientY - 20 });
    expect(keys()[0].atMs).toBe(1500);
    expect(keys()[0].value).toBeGreaterThan(0.2);
    expect(editor.view.getState().selectedKeys).toEqual([{ property: "x", atMs: 1500 }]);
    act(() => editor.store.getState().undo());
    expect(keys().map((key) => [key.atMs, key.value])).toEqual([
      [1000, 0.2],
      [3000, 0.8],
    ]);
  });

  it("drags the departure handle of a selected key to change its influence", { timeout: 15_000 }, () => {
    const { editor } = openGraph();
    act(() => editor.view.setState({ selectedKeys: [{ property: "x", atMs: 1000 }] }));
    const graph = screen.getByRole("application", { name: "Gráfico de valor" });
    const handle = screen.getByLabelText("Alça de Saída de Posição X em 1000 ms").querySelector("circle")!;
    const start = center(handle);
    fireEvent.pointerDown(graph, { button: 0, pointerId: 1, ...start });
    fireEvent.pointerMove(graph, { pointerId: 1, clientX: start.clientX + 40, clientY: start.clientY });
    fireEvent.pointerUp(graph, { pointerId: 1, clientX: start.clientX + 40, clientY: start.clientY });
    const keyframes = findClip(editor.store.getState().document, "a")!.clip.keyframes;
    expect(keySide(keyframes, "x", 1000, "out")!.influence).toBeCloseTo(0.533, 2);
    expect(editor.view.getState().graphTarget).toBe("out");
  });

  it("nudges selected keys and the chosen handle from the keyboard", { timeout: 15_000 }, () => {
    const { editor } = openGraph();
    const keyframes = () => findClip(editor.store.getState().document, "a")!.clip.keyframes;
    act(() => editor.view.setState({ selectedKeys: [{ property: "x", atMs: 1000 }] }));
    const graph = screen.getByRole("application", { name: "Gráfico de valor" });
    fireEvent.keyDown(graph, { key: "ArrowRight" });
    expect(keyframes()!.x![0].atMs).toBe(1033);
    fireEvent.keyDown(graph, { key: "ArrowUp" });
    expect(keyframes()!.x![0].value).toBeGreaterThan(0.2);
    fireEvent.click(screen.getByRole("button", { name: "Saída" }));
    fireEvent.keyDown(graph, { key: "ArrowRight", shiftKey: true });
    expect(keySide(keyframes(), "x", 1033, "out")!.influence).toBeCloseTo(0.433, 3);
    expect(graph).toHaveTextContent(/influência 43%/);
    fireEvent.keyDown(graph, { key: "Escape" });
    expect(editor.view.getState().graphTarget).toBe("keys");
  });

  it("scales the selected keys in time with the transform box", { timeout: 15_000 }, () => {
    const { editor } = openGraph();
    act(() => editor.view.setState({ selectedKeys: [{ property: "x", atMs: 1000 }, { property: "x", atMs: 3000 }] }));
    const graph = screen.getByRole("application", { name: "Gráfico de valor" });
    const first = center(screen.getByLabelText("Quadro-chave de Posição X em 1000 ms"));
    const last = center(screen.getByLabelText("Quadro-chave de Posição X em 3000 ms"));
    const middle = (first.clientY + last.clientY) / 2;
    fireEvent.pointerDown(graph, { button: 0, pointerId: 1, clientX: last.clientX, clientY: middle });
    fireEvent.pointerMove(graph, { pointerId: 1, clientX: last.clientX + 100, clientY: middle });
    fireEvent.pointerUp(graph, { pointerId: 1, clientX: last.clientX + 100, clientY: middle });
    expect(findClip(editor.store.getState().document, "a")!.clip.keyframes!.x!.map((key) => key.atMs)).toEqual([1000, 4000]);
  });
});
