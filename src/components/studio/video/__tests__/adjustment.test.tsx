import { act, fireEvent, screen } from "@testing-library/react";
import { useMemo } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";
import { newEffectClip } from "@/lib/studio/vfx";

import { useEditorState } from "../editor-context";
import { ClipInspector } from "../inspector/clip-inspector";
import { EffectsPanel } from "../panels/effects-panel";
import { renderInEditor } from "./harness";

const camera = ptMessages.studio.video.camera;

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 2000), id: "shot" }] },
    { id: "fx", kind: "visual", clips: [{ ...newEffectClip([], 0, 2000), id: "adjust" }] },
  ];
  d.durationMs = 2000;
  return d;
}

function Inspector() {
  const clip = useEditorState((s) => findClip(s.document, "adjust")!.clip);
  const track = useEditorState((s) => findClip(s.document, "adjust")!.track);
  const locations = useMemo(() => [{ clip, track, trackIndex: 1, clipIndex: 0 }], [clip, track]);
  return <ClipInspector locations={locations} />;
}

function slide(label: string, value: number) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
}

describe("adjustment clips by hand", () => {
  it("gives the effect clip Cor, Câmera and Recorte sections that grade, move and limit everything below", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    const clip = () => findClip(editor.store.getState().document, "adjust")!.clip;
    expect(screen.getByText(ptMessages.studio.grade.title)).toBeTruthy();
    expect(screen.getByText(ptMessages.studio.color.curves.title)).toBeTruthy();
    expect(screen.getByText(ptMessages.studio.color.lut.title)).toBeTruthy();
    expect(screen.getByText(camera.title)).toBeTruthy();
    expect(screen.getByText(ptMessages.studio.video.masks.title)).toBeTruthy();
    expect(screen.queryByLabelText(ptMessages.studio.video.masks.matte)).toBeNull();

    slide(ptMessages.studio.grade.fields.contrast, 30);
    expect(clip().color?.contrast).toBe(30);

    slide(camera.zoom, 150);
    expect(clip().camera).toEqual({ panX: 0, panY: 0, zoom: 1.5, rotation: 0 });
    slide(camera.panX, -20);
    expect(clip().camera?.panX).toBeCloseTo(-0.2);

    act(() => editor.view.setState({ playheadMs: 500 }));
    fireEvent.click(screen.getByRole("button", { name: ptMessages.studio.video.keyframes.keyHere.replace("{name}", camera.zoom) }));
    expect(clip().keyframes?.cameraZoom).toEqual([{ atMs: 500, value: 1.5, easing: "linear" }]);
    act(() => editor.view.setState({ playheadMs: 1500 }));
    slide(camera.zoom, 200);
    expect(clip().keyframes?.cameraZoom?.map((key) => [key.atMs, key.value])).toEqual([
      [500, 1.5],
      [1500, 2],
    ]);

    slide(camera.blur, 4);
    expect(clip().blur).toBe(4);
    fireEvent.click(screen.getByLabelText(camera.motionBlur));
    expect(clip().motionBlur).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: ptMessages.studio.video.masks.addShape.replace("{shape}", ptMessages.studio.video.masks.shapes.ellipse) }));
    expect(clip().masks).toEqual([expect.objectContaining({ shape: "ellipse" })]);
    expect(screen.getByText(ptMessages.studio.video.masks.effectHint)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: camera.reset }));
    expect(clip().camera).toBeUndefined();
    expect(clip().keyframes?.cameraZoom).toBeUndefined();
  });

  it("adds an empty adjustment clip at the playhead from the effects panel", { timeout: 15_000 }, () => {
    const start = doc();
    start.tracks = [start.tracks[0]];
    const { editor } = renderInEditor(start, <EffectsPanel />);
    act(() => editor.view.setState({ playheadMs: 400 }));
    fireEvent.click(screen.getByRole("button", { name: ptMessages.studio.video.vfx.adjustmentAdd }));
    const added = editor.store.getState().document.tracks.flatMap((track) => track.clips).find((clip) => clip.type === "effect");
    expect(added).toMatchObject({ startMs: 400, vfx: [] });
  });
});
