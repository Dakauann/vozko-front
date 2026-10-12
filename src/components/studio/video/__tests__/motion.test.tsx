import { act, fireEvent, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { anchorAt, anchorOf, placementAt } from "@/lib/studio/clip-placement";
import { CENTER_ANCHOR, canvasAspect, emptyVideoDocument, newMediaClip, type Clip, type Transform, type VideoDocument } from "@/lib/studio/document";
import type { Keyframes } from "@/lib/studio/keyframes";
import { findClip } from "@/lib/studio/timeline";

import { useEditorState } from "../editor-context";
import { PathFields } from "../inspector/path-fields";
import { PlacementFields } from "../inspector/placement-fields";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { Preview } from "../preview/preview";
import { renderInEditor } from "./harness";

const AREA = { width: 848, height: 498 };
const FRAME = { width: 800, height: 450 };
const IDS = ["c"];

function doc(transform: Transform, keyframes?: Keyframes, locked = false): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [{ id: "v", kind: "visual", locked, clips: [{ ...newMediaClip("image", "img", 0, 4000), id: "c", transform, ...(keyframes ? { keyframes } : {}) }] }];
  d.durationMs = 4000;
  return d;
}

const TURNED: Transform = { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 90, opacity: 1 };

const PATH: Keyframes = {
  position: [
    { atMs: 0, x: 0.2, y: 0.5, easing: "easeInOut" },
    { atMs: 1000, x: 0.5, y: 0.2, easing: "easeInOut" },
    { atMs: 2000, x: 0.8, y: 0.5, easing: "linear" },
  ],
};

function at(fx: number, fy: number) {
  return { clientX: fx * FRAME.width, clientY: fy * FRAME.height };
}

function drag(element: Element, from: { clientX: number; clientY: number }, to: { clientX: number; clientY: number }, init: Partial<PointerEventInit> = {}) {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, ...from, ...init });
  fireEvent.pointerMove(element, { pointerId: 1, ...to, ...init });
  fireEvent.pointerUp(element, { pointerId: 1, ...to, ...init });
}

function tap(element: Element) {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerUp(element, { pointerId: 1, clientX: 0, clientY: 0 });
}

function anchorHandle(): HTMLElement | null {
  return document.querySelector("[data-studio-anchor]");
}

function expectSamePlacement(got: Transform, want: Transform) {
  for (const key of ["x", "y", "w", "h", "rotation"] as const) expect(got[key]).toBeCloseTo(want[key], 9);
}

const originals = {
  clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"),
  clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight"),
  rect: HTMLElement.prototype.getBoundingClientRect,
};

beforeAll(() => {
  window.localStorage.setItem("studio-renderer", "legacy");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => AREA.width });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => AREA.height });
  HTMLElement.prototype.getBoundingClientRect = function rect() {
    return { left: 0, top: 0, right: FRAME.width, bottom: FRAME.height, width: FRAME.width, height: FRAME.height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
});

afterAll(() => {
  window.localStorage.removeItem("studio-renderer");
  if (originals.clientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", originals.clientWidth);
  if (originals.clientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", originals.clientHeight);
  HTMLElement.prototype.getBoundingClientRect = originals.rect;
});

function openPreview(document: VideoDocument) {
  const view = renderInEditor(document, <Preview />);
  act(() => view.editor.store.getState().select(["c"]));
  const clip = () => findClip(view.editor.store.getState().document, "c")!.clip;
  const aspect = canvasAspect(document);
  return { ...view, clip, aspect, placed: () => placementAt(clip(), view.editor.view.getState().playheadMs, aspect) };
}

describe("anchor handle on the preview", () => {
  it("moves the anchor where it is dropped and keeps the picture still, in one undo step", { timeout: 15_000 }, () => {
    const { editor, clip, aspect, placed } = openPreview(doc(TURNED));
    const before = placed();
    drag(anchorHandle()!, at(0.5, 0.5), at(0.55, 0.45));
    expect(anchorOf(clip())).toEqual(anchorAt(before, { x: 0.55, y: 0.45 }, aspect));
    expect(anchorOf(clip())).not.toEqual(CENTER_ANCHOR);
    expectSamePlacement(placed(), before);
    act(() => editor.store.getState().undo());
    expect(anchorOf(clip())).toEqual(CENTER_ANCHOR);
    expect(clip().transform).toEqual(TURNED);
  });

  it("moves only the pivot with Alt, so the turned clip swings around it, and a double click recentres it", { timeout: 15_000 }, () => {
    const { clip, placed } = openPreview(doc(TURNED));
    const before = placed();
    drag(anchorHandle()!, at(0.5, 0.5), at(0.5, 0.6), { altKey: true });
    expect(anchorOf(clip())).not.toEqual(CENTER_ANCHOR);
    expect(clip().transform).toEqual(TURNED);
    expect(Math.hypot(placed().x - before.x, placed().y - before.y)).toBeGreaterThan(0.01);
    const swung = placed();
    fireEvent.doubleClick(anchorHandle()!);
    expect(anchorOf(clip())).toEqual(CENTER_ANCHOR);
    expectSamePlacement(placed(), swung);
  });

  it("is not offered on a locked track", { timeout: 15_000 }, () => {
    openPreview(doc(TURNED, undefined, true));
    expect(anchorHandle()).toBeNull();
  });
});

describe("motion path on the preview", () => {
  const pads = () => screen.getAllByRole("button", { name: /^Posição em/ });

  it("draws a pad per key, seeks on a tap and moves a key on a drag", { timeout: 15_000 }, () => {
    const { editor, clip } = openPreview(doc({ ...TURNED, rotation: 0 }, PATH));
    expect(pads()).toHaveLength(3);
    tap(pads()[1]);
    expect(editor.view.getState().playheadMs).toBe(1000);
    expect(pads()[1]).toHaveAttribute("aria-current", "true");
    drag(pads()[0], at(0.2, 0.5), at(0.25, 0.6));
    expect(clip().keyframes?.position?.[0].x).toBeCloseTo(0.25);
    expect(clip().keyframes?.position?.[0].y).toBeCloseTo(0.6);
    act(() => editor.store.getState().undo());
    expect(clip().keyframes?.position).toEqual(PATH.position);
  });

  it("bends the path from a tangent handle, smooth by default and free with Alt", { timeout: 15_000 }, () => {
    const { clip } = openPreview(doc({ ...TURNED, rotation: 0 }, PATH));
    const outgoing = screen.getAllByLabelText(/^Alça de saída/);
    const incoming = screen.getAllByLabelText(/^Alça de entrada/);
    expect(outgoing).toHaveLength(2);
    expect(incoming).toHaveLength(2);
    drag(outgoing[1], at(0.55, 0.2), at(0.65, 0.15));
    const smooth = clip().keyframes!.position![1];
    expect(smooth.spatial).toBe("smooth");
    expect(smooth.out!.x).toBeGreaterThan(0);
    expect(smooth.in!.x).toBeLessThan(0);
    drag(screen.getAllByLabelText(/^Alça de entrada/)[0], at(0.45, 0.2), at(0.45, 0.35), { altKey: true });
    const free = clip().keyframes!.position![1];
    expect(free.spatial).toBe("free");
    expect(free.out).toEqual(smooth.out);
  });

  it("changes the shape at a key from its right click menu", { timeout: 15_000 }, () => {
    const { clip } = openPreview(doc({ ...TURNED, rotation: 0 }, PATH));
    fireEvent.contextMenu(pads()[2]);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Reta" }));
    expect(clip().keyframes?.position?.[2].spatial).toBe("linear");
  });

  it("only seeks on a locked track", { timeout: 15_000 }, () => {
    const { editor, clip } = openPreview(doc({ ...TURNED, rotation: 0 }, PATH, true));
    drag(pads()[0], at(0.2, 0.5), at(0.3, 0.6));
    expect(clip().keyframes?.position).toEqual(PATH.position);
    tap(pads()[2]);
    expect(editor.view.getState().playheadMs).toBe(2000);
  });
});

function Placement() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const editor = useSelectionEditor(IDS);
  return <PlacementFields clips={[clip]} disabled={false} editor={editor} />;
}

function Path() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const editor = useSelectionEditor(IDS);
  return <PathFields clips={[clip]} disabled={false} editor={editor} />;
}

function commit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

function inspect(ui: ReactNode, transform: Transform, keyframes?: Keyframes) {
  const document = doc(transform, keyframes);
  const view = renderInEditor(document, ui);
  const clip = (): Clip => findClip(view.editor.store.getState().document, "c")!.clip;
  return { ...view, clip, placed: () => placementAt(clip(), 0, canvasAspect(document)) };
}

describe("placement fields", () => {
  it("sets the anchor from the nine point grid and the fields without moving the picture", { timeout: 15_000 }, () => {
    const { clip, placed } = inspect(<Placement />, { ...TURNED, rotation: 30 });
    const before = placed();
    const corner = screen.getByRole("button", { name: "Canto inferior esquerdo" });
    expect(corner).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(corner);
    expect(anchorOf(clip())).toEqual({ x: 0, y: 1 });
    expect(screen.getByRole("button", { name: "Canto inferior esquerdo" })).toHaveAttribute("aria-pressed", "true");
    expectSamePlacement(placed(), before);
    commit("Âncora X", "25");
    expect(anchorOf(clip())).toEqual({ x: 0.25, y: 1 });
    expectSamePlacement(placed(), before);
    fireEvent.click(screen.getByRole("button", { name: "Centro" }));
    expect(anchorOf(clip())).toEqual(CENTER_ANCHOR);
  });

  it("mirrors the picture on each axis and turns the mirror off again", { timeout: 15_000 }, () => {
    const { clip } = inspect(<Placement />, TURNED);
    fireEvent.click(screen.getByRole("button", { name: "Espelhar na horizontal" }));
    expect(clip().flipX).toBe(true);
    expect(screen.getByRole("button", { name: "Espelhar na horizontal" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Espelhar na vertical" }));
    expect(clip().flipY).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Espelhar na horizontal" }));
    expect(clip().flipX).toBeUndefined();
    expect(clip().transform).toEqual(TURNED);
  });
});

const SCALE = [
  { atMs: 0, value: 1, easing: "linear" as const },
  { atMs: 1000, value: 1.5, easing: "easeOut" as const },
];

const LANES: Keyframes = {
  scale: SCALE,
  x: [
    { atMs: 0, value: 0.2, easing: "easeInOut" },
    { atMs: 1000, value: 0.8, easing: "easeInOut" },
  ],
  y: [
    { atMs: 0, value: 0.5, easing: "easeInOut" },
    { atMs: 1000, value: 0.3, easing: "easeInOut" },
  ],
};

describe("path fields", () => {
  it("splits the scale into width and height and joins it back", { timeout: 15_000 }, () => {
    const { clip } = inspect(<Path />, TURNED, LANES);
    fireEvent.click(screen.getByLabelText("Escala separada em largura e altura"));
    expect(clip().keyframes?.scale).toBeUndefined();
    expect(clip().keyframes?.scaleX).toEqual(SCALE);
    expect(clip().keyframes?.scaleY).toEqual(SCALE);
    fireEvent.click(screen.getByLabelText("Escala separada em largura e altura"));
    expect(clip().keyframes?.scale).toEqual(SCALE);
    expect(clip().keyframes?.scaleX).toBeUndefined();
  });

  it("asks which axis to keep when width and height differ", { timeout: 15_000 }, () => {
    const tall = [{ atMs: 0, value: 0.5, easing: "linear" as const }];
    const { clip } = inspect(<Path />, TURNED, { scaleX: SCALE, scaleY: tall });
    expect(screen.getByLabelText("Escala separada em largura e altura")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Escala separada em largura e altura"));
    expect(clip().keyframes?.scaleX).toEqual(SCALE);
    fireEvent.click(screen.getByRole("button", { name: "Manter a altura" }));
    expect(clip().keyframes?.scale).toEqual(tall);
    expect(clip().keyframes?.scaleY).toBeUndefined();
    expect(screen.queryByRole("group", { name: /Qual manter/ })).toBeNull();
  });

  it("curves x and y into a path, orients the clip along it, shapes a key and straightens it back", { timeout: 15_000 }, () => {
    const { clip } = inspect(<Path />, TURNED, LANES);
    expect(screen.getByLabelText("Seguir a direção do caminho")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Caminho curvo"));
    expect(clip().keyframes?.x).toBeUndefined();
    expect(clip().keyframes?.position?.map((key) => [key.atMs, key.x, key.y, key.spatial])).toEqual([
      [0, 0.2, 0.5, "auto"],
      [1000, 0.8, 0.3, "auto"],
    ]);
    fireEvent.click(screen.getByLabelText("Seguir a direção do caminho"));
    expect(clip().autoOrient).toBe(true);
    fireEvent.change(screen.getByLabelText("Forma do caminho nesta chave"), { target: { value: "linear" } });
    expect(clip().keyframes?.position?.[0].spatial).toBe("linear");
    fireEvent.click(screen.getByLabelText("Caminho curvo"));
    expect(clip().keyframes?.position).toBeUndefined();
    expect(clip().keyframes?.x?.length).toBeGreaterThan(0);
    expect(clip().keyframes?.y?.length).toBeGreaterThan(0);
  });

  it("offers no curve for a clip that does not move", { timeout: 15_000 }, () => {
    inspect(<Path />, TURNED);
    expect(screen.getByLabelText("Caminho curvo")).toBeDisabled();
    expect(screen.queryByLabelText("Forma do caminho nesta chave")).toBeNull();
  });
});
