import { act, fireEvent } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { boxPointAt, placementAt } from "@/lib/studio/clip-placement";
import { canvasAspect, emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";
import { newEffectClip, newVfx, type Vfx } from "@/lib/studio/vfx";

import { Preview } from "../preview/preview";
import { renderInEditor, stubPreviewLayout } from "./harness";

const FRAME = { width: 800, height: 450 };
let restore: () => void = () => undefined;

beforeAll(() => {
  restore = stubPreviewLayout({ area: { width: 848, height: 498 }, frame: FRAME });
});

afterAll(() => restore());

function film(clip: Clip, locked = false): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [{ id: "v", kind: "visual", locked, clips: [clip] }];
  d.durationMs = 2000;
  return d;
}

function at(fx: number, fy: number) {
  return { clientX: fx * FRAME.width, clientY: fy * FRAME.height };
}

function handles(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-studio-vfx-point]"));
}

function open(d: VideoDocument) {
  const view = renderInEditor(d, <Preview />);
  act(() => view.editor.store.getState().select(["c"]));
  const clip = () => findClip(view.editor.store.getState().document, "c")!.clip;
  return { ...view, clip };
}

function drag(element: Element, to: { clientX: number; clientY: number }) {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(element, { pointerId: 1, ...to });
  fireEvent.pointerUp(element, { pointerId: 1, ...to });
}

const flare = (extra: Partial<Vfx> = {}): Vfx => ({ ...newVfx("lensFlare", "flare", 3), ...extra });

describe("light source handles on the preview", () => {
  it("drags the lens flare of an effect clip across the whole frame in one undo step", { timeout: 15_000 }, () => {
    const { editor, clip } = open(film({ ...newEffectClip([flare(), newVfx("grain", "g", 1)], 0, 2000), id: "c" }));
    expect(handles().map((handle) => handle.dataset.studioVfxPoint)).toEqual(["flare"]);
    expect(handles()[0].title).toBe("Arrastar a posição de Reflexo de lente");
    expect(handles()[0].style.left).toBe("25%");
    drag(handles()[0], at(0.6, 0.4));
    expect(clip().vfx?.[0].params).toMatchObject({ x: 0.6, y: 0.4 });
    act(() => editor.store.getState().undo());
    expect(clip().vfx?.[0].params?.x).toBeUndefined();
  });

  it("places a light leak inside a turned clip in that clip's own box", { timeout: 15_000 }, () => {
    const turned = { x: 0.5, y: 0.5, w: 0.4, h: 0.4, rotation: 90, opacity: 1 };
    const d = film({ ...newMediaClip("image", "img", 0, 2000), id: "c", transform: turned, vfx: [{ ...newVfx("lightLeak", "leak", 2) }] });
    const { clip } = open(d);
    const placed = placementAt(clip(), 0, canvasAspect(d));
    drag(handles()[0], at(0.55, 0.45));
    const want = boxPointAt(placed, { x: 0.55, y: 0.45 }, canvasAspect(d));
    expect(clip().vfx?.[0].params?.x).toBeCloseTo(want.x, 3);
    expect(clip().vfx?.[0].params?.y).toBeCloseTo(want.y, 3);
  });

  it("shows no handle for hidden effects, effects without a position or a locked track", { timeout: 15_000 }, () => {
    open(film({ ...newEffectClip([flare({ hidden: true }), newVfx("vignette", "n", 0)], 0, 2000), id: "c" }));
    expect(handles()).toHaveLength(0);
  });

  it("leaves a locked track alone", { timeout: 15_000 }, () => {
    open(film({ ...newEffectClip([flare()], 0, 2000), id: "c" }, true));
    expect(handles()).toHaveLength(0);
  });
});
