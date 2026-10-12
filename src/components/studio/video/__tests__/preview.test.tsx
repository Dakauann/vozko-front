import { act, fireEvent, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { Preview } from "../preview/preview";
import { renderInEditor } from "./harness";

const AREA = { width: 848, height: 498 };
const FRAME_MARGIN = 24;
const FRAME = { width: 800, height: 450 };

function doc(locked = false): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [
    { id: "v0", kind: "visual", clips: [{ ...newMediaClip("image", "bg-img", 0, 4000), id: "bg" }] },
    {
      id: "v1",
      kind: "visual",
      locked,
      clips: [{ ...newMediaClip("image", "top-img", 0, 4000), id: "top", transform: { x: 0.25, y: 0.25, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } }],
    },
  ];
  d.durationMs = 4000;
  return d;
}

function frame(): HTMLElement {
  return document.querySelector("[data-studio-preview-frame]") as HTMLElement;
}

function at(fx: number, fy: number) {
  return { clientX: fx * FRAME.width, clientY: fy * FRAME.height };
}

function press(element: Element, point: { clientX: number; clientY: number }, init: Partial<PointerEventInit> = {}) {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, ...point, ...init });
}

function release(element: Element, point: { clientX: number; clientY: number }) {
  fireEvent.pointerUp(element, { pointerId: 1, ...point });
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

describe("Preview selection", () => {
  it("fits the frame inside the area", () => {
    renderInEditor(doc(), <Preview />);
    expect(frame().style.width).toBe(`${AREA.width - FRAME_MARGIN * 2}px`);
  });

  it("selects the clip on top when a full frame clip below it is selected, even when the press lands on the selection", () => {
    const { editor } = renderInEditor(doc(), <Preview />);
    act(() => editor.store.getState().select(["bg"]));
    press(screen.getByRole("group", { name: /Clipe selecionado/ }), at(0.25, 0.25));
    expect(editor.store.getState().selection).toEqual(["top"]);
  });

  it("selects and drags a clip in one press, leaving the clip below where it was", () => {
    const { editor } = renderInEditor(doc(), <Preview />);
    act(() => editor.store.getState().select(["bg"]));
    press(frame(), at(0.25, 0.25));
    fireEvent.pointerMove(frame(), { pointerId: 1, ...at(0.3, 0.25) });
    fireEvent.pointerMove(frame(), { pointerId: 1, ...at(0.35, 0.3) });
    release(frame(), at(0.35, 0.3));
    const state = editor.store.getState();
    expect(findClip(state.document, "top")?.clip.transform.x).toBeCloseTo(0.35);
    expect(findClip(state.document, "top")?.clip.transform.y).toBeCloseTo(0.3);
    expect(findClip(state.document, "bg")?.clip.transform.x).toBe(0.5);
    act(() => editor.store.getState().undo());
    expect(findClip(editor.store.getState().document, "top")?.clip.transform.x).toBe(0.25);
  });

  it("moves the selected clip from its body when it is the topmost under the pointer", () => {
    const { editor } = renderInEditor(doc(), <Preview />);
    act(() => editor.store.getState().select(["bg"]));
    press(frame(), at(0.8, 0.8));
    fireEvent.pointerMove(frame(), { pointerId: 1, ...at(0.7, 0.8) });
    release(frame(), at(0.7, 0.8));
    expect(editor.store.getState().selection).toEqual(["bg"]);
    expect(findClip(editor.store.getState().document, "bg")?.clip.transform.x).toBeCloseTo(0.4);
  });

  it("keeps a plain click out of the history", () => {
    const { editor } = renderInEditor(doc(), <Preview />);
    press(frame(), at(0.25, 0.25));
    fireEvent.pointerMove(frame(), { pointerId: 1, clientX: 0.25 * FRAME.width + 1, clientY: 0.25 * FRAME.height });
    release(frame(), at(0.25, 0.25));
    expect(editor.store.getState().selection).toEqual(["top"]);
    expect(editor.store.getState().canUndo).toBe(false);
    expect(findClip(editor.store.getState().document, "top")?.clip.transform.x).toBe(0.25);
  });

  it("selects through to the clip below with Alt and wraps back to the top", () => {
    const { editor } = renderInEditor(doc(), <Preview />);
    act(() => editor.store.getState().select(["top"]));
    press(frame(), at(0.25, 0.25), { altKey: true });
    release(frame(), at(0.25, 0.25));
    expect(editor.store.getState().selection).toEqual(["bg"]);
    press(frame(), at(0.25, 0.25), { altKey: true });
    release(frame(), at(0.25, 0.25));
    expect(editor.store.getState().selection).toEqual(["top"]);
  });

  it("never picks a clip on a locked track", () => {
    const { editor } = renderInEditor(doc(true), <Preview />);
    press(frame(), at(0.25, 0.25));
    release(frame(), at(0.25, 0.25));
    expect(editor.store.getState().selection).toEqual(["bg"]);
  });
});
