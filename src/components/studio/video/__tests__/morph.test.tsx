import { act, fireEvent, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, newOverlayClip, newPathLayer, newShapeLayer, type Clip, type Layer, type VideoDocument } from "@/lib/studio/document";
import { morphFramesOf } from "@/lib/studio/keyframes";
import { newMask } from "@/lib/studio/masks";
import { pathVertices } from "@/lib/studio/path-morph";
import { findClip } from "@/lib/studio/timeline";

import { useEditorState } from "../editor-context";
import { MaskFields } from "../inspector/mask-fields";
import { MorphFields } from "../inspector/morph-fields";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { PathKeyOverlay } from "../preview/path-key-overlay";
import { renderInEditor, stubPreviewLayout } from "./harness";

const IDS = ["c"];
const FRAME = { width: 600, height: 600 };
const SQUARE = "M0 0 L1 0 L1 1 L0 1 Z";
const TRIANGLE = "M0.5 0 L1 1 L0 1 Z";

let restore: () => void = () => undefined;

beforeAll(() => {
  restore = stubPreviewLayout({ area: { width: 648, height: 648 }, frame: FRAME });
});

afterAll(() => restore());

function film(layer: Layer, extra: Partial<Clip> = {}): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [{ id: "v", kind: "visual", clips: [{ ...newOverlayClip(layer, 0, 2000, { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 }), id: "c", ...extra }] }];
  d.durationMs = 2000;
  return d;
}

function Morph() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const editor = useSelectionEditor(IDS);
  return <MorphFields clip={clip} disabled={false} editor={editor} />;
}

function Masks() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const editor = useSelectionEditor(IDS);
  return <MaskFields clip={clip} disabled={false} editor={editor} />;
}

function FramedOverlay() {
  const frame = useRef<HTMLDivElement>(null);
  return (
    <div ref={frame}>
      <PathKeyOverlay clipId="c" frameRef={frame} />
    </div>
  );
}

function drag(element: Element, to: { clientX: number; clientY: number }) {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(element, { pointerId: 1, ...to });
  fireEvent.pointerUp(element, { pointerId: 1, ...to });
}

describe("shape morph by hand", () => {
  it("keys a rectangle into a path, picks a first vertex, opens point editing and removes the key", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(film(newShapeLayer("rect")), <Morph />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;
    expect(screen.getByText("Retângulos, elipses, triângulos e estrelas viram um caminho editável na primeira chave.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Chave da forma no cursor" }));
    expect(clip().layer?.shape).toBe("path");
    expect(morphFramesOf(clip().keyframes).map((key) => key.atMs)).toEqual([0]);

    fireEvent.change(screen.getByLabelText("Primeiro ponto"), { target: { value: "2" } });
    const key = morphFramesOf(clip().keyframes)[0];
    expect(key.firstVertex).toEqual(pathVertices(key.path)[2]);
    fireEvent.change(screen.getByLabelText("Primeiro ponto"), { target: { value: "auto" } });
    expect(morphFramesOf(clip().keyframes)[0].firstVertex).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Editar pontos no quadro" }));
    expect(editor.view.getState().pathEdit).toEqual({ clipId: "c" });
    fireEvent.click(screen.getByRole("button", { name: "Concluir edição" }));
    expect(editor.view.getState().pathEdit).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Remover a chave em/ }));
    expect(clip().keyframes).toBeUndefined();
    expect(clip().layer?.shape).toBe("path");
  });

  it("drags a point on the frame between two keys and records a new key there, and a double click picks the first vertex", { timeout: 15_000 }, () => {
    const d = film(newPathLayer(SQUARE), { keyframes: { path: [{ atMs: 0, path: SQUARE, easing: "linear" }, { atMs: 1000, path: TRIANGLE, easing: "linear" }] } });
    const { editor } = renderInEditor(d, <FramedOverlay />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;
    act(() => {
      editor.store.getState().select(["c"]);
      editor.view.setState({ playheadMs: 1500, pathEdit: { clipId: "c" } });
    });
    const nodes = () => Array.from(document.querySelectorAll<HTMLElement>("[data-studio-path-node]"));
    expect(nodes()).toHaveLength(3);
    drag(nodes()[0], { clientX: 0.5 * FRAME.width, clientY: 0.4 * FRAME.height });
    const keys = morphFramesOf(clip().keyframes);
    expect(keys.map((key) => key.atMs)).toEqual([0, 1000, 1500]);
    expect(pathVertices(keys[2].path)[0].y).toBeCloseTo(0.3, 3);

    fireEvent.doubleClick(nodes()[1]);
    expect(morphFramesOf(clip().keyframes)[2].firstVertex).toEqual(pathVertices(keys[2].path)[1]);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(editor.view.getState().pathEdit).toBeNull();
  });

  it("keys the path of a path mask and picks the first vertex of its key", { timeout: 15_000 }, () => {
    const d = emptyVideoDocument("square");
    d.tracks = [{ id: "v", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 2000), id: "c", masks: [{ ...newMask("path", "m"), path: SQUARE }] }] }];
    d.durationMs = 2000;
    const { editor } = renderInEditor(d, <Masks />);
    const mask = () => findClip(editor.store.getState().document, "c")!.clip.masks![0];
    act(() => editor.view.setState({ playheadMs: 400 }));
    fireEvent.click(screen.getByRole("button", { name: "Chave de Caminho SVG no cursor" }));
    expect(mask().keyframes?.path?.map((key) => key.atMs)).toEqual([400]);
    fireEvent.change(screen.getByLabelText("Primeiro ponto"), { target: { value: "1" } });
    expect(mask().keyframes?.path?.[0].firstVertex).toEqual({ x: 1, y: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Editar pontos no quadro" }));
    expect(editor.view.getState().pathEdit).toEqual({ clipId: "c", maskId: "m" });
  });
});
