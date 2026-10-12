import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newMediaClip, newNullClip, type VideoDocument } from "@/lib/studio/document";
import { visualPlan } from "@/lib/studio/playback";
import { findClip } from "@/lib/studio/timeline";

import { Inspector } from "../inspector/inspector";
import { ElementsPanel } from "../panels/elements-panel";
import { Preview } from "../preview/preview";
import { Timeline } from "../timeline/timeline";
import { renderInEditor, stubPreviewLayout } from "./harness";

const pt = ptMessages.studio.video.parenting;

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  const photo = { ...newMediaClip("image", "img", 0, 4000), id: "photo", transform: { x: 0.3, y: 0.4, w: 0.3, h: 0.2, rotation: 0, opacity: 1 } };
  const rig = { ...newNullClip(0, 4000, 0.5, 0.5), id: "rig", keyframes: { rotation: [{ atMs: 0, value: 0, easing: "linear" as const }, { atMs: 2000, value: 90, easing: "linear" as const }] } };
  d.tracks = [
    { id: "v1", kind: "visual", clips: [photo] },
    { id: "v2", kind: "visual", clips: [rig] },
  ];
  d.durationMs = 4000;
  return d;
}

function placed(d: VideoDocument, id: string, atMs: number) {
  return visualPlan(d, atMs, 0).find((item) => item.clipId === id)!.transform;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parenting by hand", () => {
  it("picks a parent in the inspector keeping the picture, selects the children and releases the link", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    const before = placed(editor.store.getState().document, "photo", 0);
    act(() => editor.store.getState().select(["photo"]));
    fireEvent.change(screen.getByLabelText(pt.picker), { target: { value: "rig" } });
    const linked = editor.store.getState().document;
    expect(findClip(linked, "photo")!.clip.parentId).toBe("rig");
    expect(placed(linked, "photo", 0).x).toBeCloseTo(before.x, 9);
    expect(placed(linked, "photo", 2000).rotation).toBeCloseTo(90, 9);

    act(() => editor.store.getState().select(["rig"]));
    fireEvent.click(screen.getByRole("button", { name: "Selecionar 1 filho" }));
    expect(editor.store.getState().selection).toEqual(["photo"]);

    fireEvent.change(screen.getByLabelText(pt.picker), { target: { value: "none" } });
    expect(findClip(editor.store.getState().document, "photo")!.clip.parentId).toBeUndefined();
  });

  it("jumps into the parent's space when keep position is off", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["photo"]));
    fireEvent.click(screen.getByLabelText(pt.keepVisual));
    fireEvent.change(screen.getByLabelText(pt.picker), { target: { value: "rig" } });
    const photo = findClip(editor.store.getState().document, "photo")!.clip;
    expect(photo.parentId).toBe("rig");
    expect(photo.transform.x).toBe(0.3);
  });

  it("adds a null from the elements panel at the playhead", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <ElementsPanel />);
    act(() => editor.view.setState({ playheadMs: 1000 }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(pt.addNull) }));
    const created = editor.store.getState().selection[0];
    expect(findClip(editor.store.getState().document, created)!.clip).toMatchObject({ type: "null", startMs: 1000, durationMs: 3000 });
  });

  it("drags the pick whip from one clip onto another, and Alt click releases", { timeout: 15_000 }, () => {
    const { editor, container } = renderInEditor(doc(), <Timeline />);
    const whip = container.querySelector<HTMLElement>('[data-parent-whip="photo"]')!;
    const target = container.querySelector<HTMLElement>('[data-clip-id="rig"]')!;
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn(() => target) });
    fireEvent.pointerDown(whip, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(whip, { pointerId: 1, clientX: 40, clientY: 60 });
    expect(document.body.querySelector("svg line")).toBeTruthy();
    fireEvent.pointerUp(whip, { pointerId: 1, clientX: 40, clientY: 60 });
    expect(findClip(editor.store.getState().document, "photo")!.clip.parentId).toBe("rig");
    expect(container.querySelector('[data-parent-whip="photo"]')!.getAttribute("data-parented")).toBe("true");
    fireEvent.pointerDown(container.querySelector<HTMLElement>('[data-parent-whip="photo"]')!, { button: 0, pointerId: 2, altKey: true });
    expect(findClip(editor.store.getState().document, "photo")!.clip.parentId).toBeUndefined();
  });

  it("outlines nulls in the preview and moves a parented clip where the pointer puts it", { timeout: 15_000 }, () => {
    const restore = stubPreviewLayout({ area: { width: 498, height: 848 }, frame: { width: 450, height: 800 } });
    try {
      const linked = doc();
      linked.tracks[0].clips[0] = { ...linked.tracks[0].clips[0], parentId: "rig" };
      const { editor, container } = renderInEditor(linked, <Preview />);
      act(() => editor.view.setState({ playheadMs: 2000, snapping: false }));
      expect(container.querySelector('[data-null-outline="rig"]')).toBeTruthy();
      const world = placed(editor.store.getState().document, "photo", 2000);
      const frame = container.querySelector<HTMLElement>("[data-studio-preview-frame]")!;
      const start = { clientX: world.x * 450, clientY: world.y * 800 };
      fireEvent.pointerDown(frame, { button: 0, pointerId: 1, ...start });
      fireEvent.pointerMove(frame, { pointerId: 1, clientX: start.clientX + 45, clientY: start.clientY });
      fireEvent.pointerUp(frame, { pointerId: 1, clientX: start.clientX + 45, clientY: start.clientY });
      expect(editor.store.getState().selection).toEqual(["photo"]);
      const moved = placed(editor.store.getState().document, "photo", 2000);
      expect(moved.x).toBeCloseTo(world.x + 0.1, 6);
      expect(moved.y).toBeCloseTo(world.y, 6);
      expect(findClip(editor.store.getState().document, "photo")!.clip.parentId).toBe("rig");
    } finally {
      restore();
    }
  });
});
