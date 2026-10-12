import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const uploadMedia = vi.fn();
const listLibrary = vi.fn(async () => ({ data: [] as unknown[] }));
vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: () => listLibrary(),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: (form: FormData) => uploadMedia(form),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { sourceSpanMs } from "@/lib/studio/clip-time";
import { cubeText } from "@/lib/studio/cube-lut";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { Inspector } from "../inspector/inspector";
import { renderInEditor } from "./harness";

const pt = ptMessages.studio;

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 4000), id: "shot", linkId: "pair" }] },
    { id: "a", kind: "audio", clips: [{ ...newMediaClip("audio", "vid", 0, 4000), id: "sound", linkId: "pair" }] },
  ];
  d.durationMs = 8000;
  return d;
}

function open(group: keyof typeof pt.inspector.groups) {
  fireEvent.click(screen.getByRole("tab", { name: pt.inspector.groups[group] }));
}

function shotOf(editor: ReturnType<typeof renderInEditor>["editor"]) {
  return findClip(editor.store.getState().document, "shot")!.clip;
}

describe("the Cor tab by hand", () => {
  it("shapes a curve on the master and on one channel", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => {
      editor.store.getState().select(["shot"]);
      editor.view.setState({ playheadMs: 1000 });
    });
    open("color");
    const curves = within(screen.getByRole("group", { name: pt.color.curves.presets }));
    fireEvent.click(curves.getByRole("button", { name: pt.color.curves.presetNames.contrast }));
    expect(shotOf(editor).color?.curves?.master).toHaveLength(4);
    fireEvent.click(screen.getByRole("radio", { name: pt.color.curves.channels.blue }));
    const point = screen.getByRole("slider", { name: pt.color.curves.point.replace("{number}", "2") });
    fireEvent.keyDown(point, { key: "ArrowUp" });
    expect(shotOf(editor).color?.curves?.blue).toBeUndefined();
    fireEvent.keyDown(screen.getByRole("slider", { name: pt.color.curves.point.replace("{number}", "1") }), { key: "ArrowUp" });
    expect(shotOf(editor).color?.curves?.blue?.[0].y).toBeCloseTo(1 / 255, 9);
  });

  it("picks a color to keep and keys the grade at the playhead", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => {
      editor.store.getState().select(["shot"]);
      editor.view.setState({ playheadMs: 1000 });
    });
    open("color");
    fireEvent.click(screen.getByRole("switch", { name: pt.color.hsl.toggle }));
    expect(shotOf(editor).color?.hsl).toEqual({ hue: 0, width: 40, softness: 30, desaturate: 100 });
    fireEvent.click(screen.getByRole("button", { name: pt.color.hsl.colorNames.green }));
    expect(shotOf(editor).color?.hsl?.hue).toBe(120);

    const diamond = screen.getByRole("button", { name: pt.video.keyframes.keyHere.replace("{name}", pt.grade.fields.exposure) });
    fireEvent.click(diamond);
    expect(shotOf(editor).keyframes?.exposure).toEqual([{ atMs: 1000, value: 0, easing: "linear" }]);
  });

  it("imports a LUT file, uses it and says why a broken file is refused", { timeout: 15_000 }, async () => {
    uploadMedia.mockResolvedValue({ mediaId: "look-1", mediaUrl: "https://cdn/look.cube" });
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["shot"]));
    open("color");
    const input = screen.getByLabelText(pt.color.lut.import, { selector: "input" });
    fireEvent.change(input, { target: { files: [new File(["LUT_3D_SIZE 2\n0 0 0\n"], "broken.cube")] } });
    expect(await screen.findByText(pt.color.lut.faults.rows)).toBeTruthy();
    expect(uploadMedia).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File([cubeText(2, (r, g, b) => [r, g, b])], "Quente.cube")] } });
    await waitFor(() => expect(shotOf(editor).color?.lut).toEqual({ assetId: "look-1" }));
    const form = uploadMedia.mock.calls[0][0] as FormData;
    expect(form.get("mediaType")).toBe("lut");
    expect(form.get("description")).toBe("Quente");
  });

  it("maps a clip through a gradient", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["shot"]));
    open("color");
    fireEvent.click(screen.getByRole("switch", { name: pt.image.paint.gradientMap.toggle }));
    expect(shotOf(editor).gradientMap?.stops).toHaveLength(2);
  });
});

describe("speed curves by hand", () => {
  it("applies a ready curve to the pair, edits a point, mixes frames and removes the curve", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["shot"]));
    open("speed");
    const curve = pt.video.speed.curve;
    fireEvent.click(within(screen.getByRole("group", { name: curve.presets })).getByRole("button", { name: curve.presetNames.hero }));
    const shot = shotOf(editor);
    expect(shot.keyframes?.speed?.map((key) => key.value)).toEqual([1.5, 0.3, 0.3, 1.5]);
    expect(Math.abs(sourceSpanMs(shot) - 4000)).toBeLessThanOrEqual(2);
    expect(findClip(editor.store.getState().document, "sound")!.clip.keyframes?.speed).toEqual(shot.keyframes?.speed);

    fireEvent.keyDown(screen.getByRole("slider", { name: curve.point.replace("{number}", "2") }), { key: "ArrowUp" });
    expect(shotOf(editor).keyframes?.speed?.[1].value).toBeCloseTo(0.35, 9);

    fireEvent.click(screen.getByRole("checkbox", { name: pt.video.speed.frameMix }));
    expect(shotOf(editor).frameMix).toBe(true);

    const edited = shotOf(editor);
    fireEvent.click(screen.getByRole("button", { name: curve.clear }));
    expect(shotOf(editor).keyframes?.speed).toBeUndefined();
    expect(shotOf(editor).durationMs).toBe(edited.durationMs);
    expect(Math.abs(sourceSpanMs(shotOf(editor)) - sourceSpanMs(edited))).toBeLessThanOrEqual(4);
  });

  it("ramps smoothly inside one clip by default", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => {
      editor.store.getState().select(["shot"]);
      editor.view.setState({ playheadMs: 1000 });
    });
    open("speed");
    fireEvent.click(screen.getByRole("button", { name: pt.video.speed.ramp.apply }));
    const clips = editor.store.getState().document.tracks[0].clips;
    expect(clips).toHaveLength(1);
    expect(clips[0].keyframes?.speed?.map((key) => key.atMs)).toEqual([1000, 1600]);
  });
});
