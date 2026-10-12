import { act, fireEvent, screen } from "@testing-library/react";
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

import { Inspector } from "../inspector/inspector";
import { PreviewQualityMenu } from "../preview/view-controls";
import { Ruler } from "../timeline/ruler";
import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

const inspector = ptMessages.studio.video.inspector;
const transport = ptMessages.studio.video.transport;
const timeline = ptMessages.studio.video.timeline;

function doc(locked = false): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [
    { id: "v1", kind: "visual", locked, clips: [{ ...newMediaClip("video", "vid", 0, 4000), id: "a" }] },
    { id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 4000), id: "m" }] },
  ];
  d.durationMs = 4000;
  return d;
}

function commit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("motion blur by hand", () => {
  it("turns motion blur on and off on a clip from the inspector", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    const toggle = screen.getByRole("checkbox", { name: inspector.motionBlur });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(findClip(editor.store.getState().document, "a")!.clip.motionBlur).toBe(true);
    expect(screen.getByRole("checkbox", { name: inspector.motionBlur })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: inspector.motionBlur }));
    expect(findClip(editor.store.getState().document, "a")!.clip.motionBlur).toBeUndefined();
  });

  it("offers no switch on sound and keeps it off on a locked track", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(true), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    expect(screen.getByRole("checkbox", { name: inspector.motionBlur })).toBeDisabled();
    act(() => editor.store.getState().select(["m"]));
    expect(screen.queryByRole("checkbox", { name: inspector.motionBlur })).not.toBeInTheDocument();
  });

  it("sets the project shutter with nothing selected, inside its range, as one undo step", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    expect(screen.getByLabelText(inspector.shutterAngle)).toHaveValue("180");
    expect(screen.getByLabelText(inspector.shutterPhase)).toHaveValue("-90");
    commit(inspector.shutterAngle, "360");
    expect(editor.store.getState().document.canvas.shutterAngle).toBe(360);
    commit(inspector.shutterAngle, "5000");
    expect(editor.store.getState().document.canvas.shutterAngle).toBe(720);
    commit(inspector.shutterPhase, "-45");
    expect(editor.store.getState().document.canvas.shutterPhase).toBe(-45);
    act(() => editor.store.getState().undo());
    expect(editor.store.getState().document.canvas.shutterPhase).toBeUndefined();
    expect(editor.store.getState().document.canvas.shutterAngle).toBe(720);
  });

  it("refuses a shutter outside its range from a command", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.commands.setShutter({ shutterAngle: -10 }));
    act(() => editor.commands.setShutter({ shutterPhase: 1000 }));
    expect(editor.store.getState().document.canvas).toEqual({ aspect: "landscape", background: "#000000" });
  });

  it("lets the preview keep motion blur while scrubbing from the quality menu", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <PreviewQualityMenu />);
    expect(editor.view.getState().blurWhileScrubbing).toBe(false);
    fireEvent.keyDown(screen.getByRole("button", { name: `Qualidade da pré-visualização: ${transport.qualities.full}` }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: transport.blurWhileScrubbing }));
    expect(editor.view.getState().blurWhileScrubbing).toBe(true);
  });

  it("marks the preview as scrubbing while the ruler is dragged", { timeout: 15_000 }, () => {
    const seek = vi.fn();
    const starts = vi.fn();
    const ends = vi.fn();
    const { editor, container } = renderInEditor(
      doc(),
      <Ruler width={800} pxPerSecond={100} scrollLeft={0} viewportWidth={800} durationMs={4000} markers={[]} range={{ inMs: null, outMs: null }} onSeek={seek} onScrubStart={starts} onScrubEnd={ends} timeAt={(x) => x * 10} />,
    );
    const ruler = container.firstElementChild as HTMLElement;
    fireEvent.pointerDown(ruler, { button: 0, pointerId: 3, clientX: 10 });
    fireEvent.pointerMove(ruler, { pointerId: 3, clientX: 40 });
    expect(starts).toHaveBeenCalledTimes(1);
    expect(ends).not.toHaveBeenCalled();
    fireEvent.pointerUp(ruler, { pointerId: 3, clientX: 40 });
    expect(ends).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenLastCalledWith(400);
    act(() => editor.commands.setScrubbing(true));
    expect(editor.view.getState().scrubbing).toBe(true);
    act(() => editor.commands.setScrubbing(false));
    expect(editor.view.getState().scrubbing).toBe(false);
  });

  it("shows which clips blur on the timeline and scrubs through the ruler", { timeout: 15_000 }, async () => {
    const d = doc();
    d.tracks[0].clips[0].motionBlur = true;
    const { editor, container } = renderInEditor(d, <Timeline />);
    await act(async () => undefined);
    expect(screen.getByRole("img", { name: timeline.motionBlur })).toBeInTheDocument();
    const ruler = container.querySelector(".cursor-col-resize") as HTMLElement;
    fireEvent.pointerDown(ruler, { button: 0, pointerId: 5, clientX: 300 });
    expect(editor.view.getState().scrubbing).toBe(true);
    fireEvent.pointerUp(ruler, { pointerId: 5, clientX: 320 });
    expect(editor.view.getState().scrubbing).toBe(false);
  });
});
