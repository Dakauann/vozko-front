import { act, fireEvent, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type Clip, type Transform, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { Inspector } from "../inspector/inspector";
import { Preview } from "../preview/preview";
import { Timeline } from "../timeline/timeline";
import { renderInEditor, stubPreviewLayout } from "./harness";

const AREA = { width: 848, height: 498 };
const FRAME = { width: 800, height: 450 };

function box(x: number, y: number, w: number, h: number): Transform {
  return { x, y, w, h, rotation: 0, opacity: 1 };
}

function image(id: string, startMs: number, transform: Transform, extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("image", `m-${id}`, startMs, 1000), id, transform, ...extra };
}

function film(): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [image("a", 0, box(0.2, 0.2, 0.1, 0.1))] },
    { id: "v2", kind: "visual", clips: [image("b", 0, box(0.5, 0.6, 0.2, 0.2))] },
    { id: "v3", kind: "visual", clips: [image("c", 0, box(0.9, 0.3, 0.1, 0.2))] },
    { id: "a1", kind: "audio", clips: [{ ...newMediaClip("audio", "m-s", 0, 3000), id: "s" }] },
  ];
  d.durationMs = 4000;
  return d;
}

function clipOf(editor: ReturnType<typeof renderInEditor>["editor"], id: string): Clip {
  return findClip(editor.store.getState().document, id)!.clip;
}

function frame(): HTMLElement {
  return document.querySelector("[data-studio-preview-frame]") as HTMLElement;
}

function at(fx: number, fy: number) {
  return { clientX: fx * FRAME.width, clientY: fy * FRAME.height };
}

let restore: () => void = () => undefined;

beforeAll(() => {
  restore = stubPreviewLayout({ area: AREA, frame: FRAME });
});

afterAll(() => restore());

describe("align and distribute in the inspector", () => {
  it("aligns one clip to the frame and undoes in one step", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(film(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    fireEvent.click(screen.getByRole("button", { name: "Alinhar à direita" }));
    expect(clipOf(editor, "a").transform.x).toBeCloseTo(0.95);
    act(() => editor.store.getState().undo());
    expect(clipOf(editor, "a").transform.x).toBeCloseTo(0.2);
  });

  it("aligns several clips to their bounds or to the frame, and distributes three", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(film(), <Inspector />);
    act(() => editor.store.getState().select(["a", "b"]));
    expect(screen.getByRole("button", { name: "Distribuir na horizontal" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Alinhar à esquerda" }));
    expect(clipOf(editor, "b").transform.x).toBeCloseTo(0.25);
    fireEvent.click(screen.getByRole("button", { name: "Quadro" }));
    fireEvent.click(screen.getByRole("button", { name: "Alinhar ao topo" }));
    expect(clipOf(editor, "a").transform.y).toBeCloseTo(0.05);
    expect(clipOf(editor, "b").transform.y).toBeCloseTo(0.1);
    act(() => editor.store.getState().select(["a", "b", "c"]));
    fireEvent.click(screen.getByRole("button", { name: "Distribuir na horizontal" }));
    expect(clipOf(editor, "b").transform.x).toBeCloseTo(0.55);
  });

  it("offers alignment when a video is selected with its sound", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(film(), <Inspector />);
    act(() => editor.store.getState().select(["a", "s"]));
    fireEvent.click(screen.getByRole("button", { name: "Centralizar na horizontal" }));
    expect(clipOf(editor, "a").transform.x).toBeCloseTo(0.5);
  });
});

describe("sequence and stagger in the inspector", () => {
  it("puts the selected clips end to end and staggers them by the step", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(film(), <Inspector />);
    act(() => editor.store.getState().select(["c", "b", "a"]));
    fireEvent.click(screen.getByRole("button", { name: "Pôr em sequência" }));
    expect(["c", "b", "a"].map((id) => clipOf(editor, id).startMs)).toEqual([0, 1000, 2000]);
    const step = screen.getByLabelText("Passo da cascata");
    fireEvent.change(step, { target: { value: "0.25" } });
    fireEvent.blur(step);
    fireEvent.click(screen.getByRole("button", { name: "Escalonar" }));
    expect(["c", "b", "a"].map((id) => clipOf(editor, id).startMs)).toEqual([0, 250, 500]);
  });
});

describe("protected edges when the speed changes", () => {
  it("keeps the intro and outro keys timed while the middle stretches", { timeout: 15_000 }, () => {
    const d = emptyVideoDocument("landscape");
    const keyed: Clip = {
      ...newMediaClip("video", "m-v", 0, 4000),
      id: "v",
      keyframes: {
        opacity: [
          { atMs: 0, value: 0, easing: "linear" },
          { atMs: 500, value: 1, easing: "linear" },
          { atMs: 3500, value: 1, easing: "linear" },
          { atMs: 4000, value: 0, easing: "linear" },
        ],
      },
    };
    d.tracks = [{ id: "v1", kind: "visual", clips: [keyed] }];
    d.durationMs = 4000;
    const { editor } = renderInEditor(d, <Inspector />);
    act(() => editor.store.getState().select(["v"]));
    const protect = screen.getByLabelText("Proteger as pontas");
    fireEvent.change(protect, { target: { value: "0.5" } });
    fireEvent.blur(protect);
    const speed = screen.getByLabelText("Velocidade", { selector: "input" });
    fireEvent.change(speed, { target: { value: "0.5" } });
    fireEvent.blur(speed);
    expect(clipOf(editor, "v").keyframes!.opacity!.map((key) => key.atMs)).toEqual([0, 500, 7500, 8000]);
  });
});

describe("snapping and smart guides in the preview", () => {
  it("snaps a dragged clip to the frame center and shows the guide and the distances", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(film(), <Preview />);
    act(() => editor.store.getState().select(["b"]));
    fireEvent.pointerDown(frame(), { button: 0, pointerId: 1, ...at(0.5, 0.6) });
    fireEvent.pointerMove(frame(), { pointerId: 1, ...at(0.504, 0.5) });
    expect(clipOf(editor, "b").transform.x).toBeCloseTo(0.5);
    expect(clipOf(editor, "b").transform.y).toBeCloseTo(0.5);
    expect(document.querySelector('[data-frame-guide="vertical"]')).not.toBeNull();
    expect(document.querySelectorAll("[data-frame-gap]").length).toBeGreaterThan(0);
    fireEvent.pointerUp(frame(), { pointerId: 1, ...at(0.504, 0.5) });
    expect(document.querySelector("[data-frame-guides]")).toBeNull();
  });

  it("moves freely with Alt held", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(film(), <Preview />);
    act(() => editor.store.getState().select(["b"]));
    fireEvent.pointerDown(frame(), { button: 0, pointerId: 1, ...at(0.5, 0.6) });
    fireEvent.pointerMove(frame(), { pointerId: 1, ...at(0.504, 0.5), altKey: true });
    fireEvent.pointerUp(frame(), { pointerId: 1, ...at(0.504, 0.5), altKey: true });
    expect(clipOf(editor, "b").transform.x).toBeCloseTo(0.504);
  });

  it("adds a clip to the selection with Shift and drags the selected clips together", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(film(), <Preview />);
    act(() => editor.store.getState().select(["a"]));
    fireEvent.pointerDown(frame(), { button: 0, pointerId: 1, ...at(0.9, 0.3), shiftKey: true });
    fireEvent.pointerUp(frame(), { pointerId: 1, ...at(0.9, 0.3), shiftKey: true });
    expect(editor.store.getState().selection).toEqual(["a", "c"]);
    expect(document.querySelectorAll("[data-selection-outline]")).toHaveLength(2);
    fireEvent.pointerDown(frame(), { button: 0, pointerId: 1, ...at(0.2, 0.2), altKey: false });
    fireEvent.pointerMove(frame(), { pointerId: 1, ...at(0.23, 0.27), altKey: true });
    fireEvent.pointerUp(frame(), { pointerId: 1, ...at(0.23, 0.27), altKey: true });
    expect(clipOf(editor, "a").transform.x).toBeCloseTo(0.23);
    expect(clipOf(editor, "c").transform.x).toBeCloseTo(0.93);
    expect(clipOf(editor, "c").transform.y).toBeCloseTo(0.37);
    expect(editor.store.getState().selection).toEqual(["a", "c"]);
  });
});

describe("timeline", () => {
  it("drags several selected clips to other lanes together", { timeout: 15_000 }, () => {
    const d = emptyVideoDocument("story");
    d.tracks = [
      { id: "v1", kind: "visual", clips: [image("a", 0, box(0.5, 0.5, 1, 1))] },
      { id: "v2", kind: "visual", clips: [image("b", 2000, box(0.5, 0.5, 1, 1))] },
      { id: "v3", kind: "visual", clips: [] },
    ];
    d.durationMs = 4000;
    const { editor } = renderInEditor(d, <Timeline />);
    act(() => editor.store.getState().select(["a", "b"]));
    const clip = document.querySelector('[data-clip-id="a"]') as HTMLElement;
    fireEvent.pointerDown(clip, { button: 0, pointerId: 1, clientX: 300, clientY: 130 });
    fireEvent.pointerMove(clip, { pointerId: 1, clientX: 300, clientY: 100 });
    fireEvent.pointerMove(clip, { pointerId: 1, clientX: 300, clientY: 80 });
    fireEvent.pointerUp(clip, { pointerId: 1, clientX: 300, clientY: 80 });
    expect(findClip(editor.store.getState().document, "a")?.track.id).toBe("v2");
    expect(findClip(editor.store.getState().document, "b")?.track.id).toBe("v3");
  });

  it("keeps the main track controls visible and folds only the extras", { timeout: 15_000 }, () => {
    renderInEditor(film(), <Timeline />);
    const control = (name: string) => screen.getByRole("button", { name }).closest("[data-track-control]");
    for (const name of ["Silenciar Áudio 1", "Ouvir só Áudio 1", "Bloquear Áudio 1", "Opções de Áudio 1", "Ocultar Vídeo 1", "Bloquear Vídeo 1", "Opções de Vídeo 1"]) {
      expect(control(name)).toHaveAttribute("data-always", "true");
    }
    const sound = document.querySelectorAll("[data-track-control]:not([data-always])");
    expect(sound.length).toBeGreaterThan(0);
  });

  it("trims and moves clips to the playhead from the clip menu commands", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(film(), <Timeline />);
    act(() => {
      editor.store.getState().select(["b"]);
      editor.view.setState({ playheadMs: 400 });
    });
    act(() => {
      editor.commands.trimToPlayhead("start", false);
    });
    expect(clipOf(editor, "b")).toMatchObject({ startMs: 400, durationMs: 600 });
    act(() => {
      editor.view.setState({ playheadMs: 2500 });
      editor.commands.moveToPlayhead("end");
    });
    expect(clipOf(editor, "b").startMs).toBe(1900);
  });
});
