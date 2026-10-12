import { act, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/media-generation", () => ({ requestMediaGenerationAction: vi.fn(), listMediaModelsAction: vi.fn().mockResolvedValue({ data: [] }), getMediaGenerationAction: vi.fn() }));
vi.mock("@/contexts/auth-context", () => ({ useSignedInUserId: () => "u-1" }));

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";

import { ElementsPanel } from "../panels/elements-panel";
import { renderInEditor } from "./harness";

function film(count: number): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  return { ...doc, durationMs: 3000, tracks: Array.from({ length: count }, (_, i) => ({ id: `t${i}`, kind: "visual" as const, clips: [{ ...newMediaClip("image", `photo-${i}`, 0, 3000), id: `c${i}` }] })) };
}

function clips(editor: ReturnType<typeof renderInEditor>["editor"]) {
  return editor.store.getState().document.tracks.map((track) => track.clips[0]);
}

describe("frames and grids from the video elements panel", () => {
  it("crops the selected picture to the frame shape", { timeout: 15_000 }, () => {
    const { editor, container } = renderInEditor(film(1), <ElementsPanel />);
    act(() => editor.store.getState().select(["c0"]));
    fireEvent.click(container.querySelector<HTMLElement>('[data-library-item="frame-circle"]')!);
    expect(clips(editor)[0].masks?.[0]).toMatchObject({ shape: "ellipse", h: 1 });
  });

  it("splits the screen between the selected clips", { timeout: 15_000 }, () => {
    const { editor, container } = renderInEditor(film(2), <ElementsPanel />);
    act(() => editor.store.getState().select(["c0", "c1"]));
    fireEvent.click(container.querySelector<HTMLElement>('[data-library-item="grid-two-columns"]')!);
    const [left, right] = clips(editor);
    expect(left.transform.x).toBeLessThan(0.5);
    expect(right.transform.x).toBeGreaterThan(0.5);
    expect(left.fit).toBe("cover");
  });

  it("explains what to select when nothing is", { timeout: 15_000 }, () => {
    const { editor, container } = renderInEditor(film(1), <ElementsPanel />);
    fireEvent.click(container.querySelector<HTMLElement>('[data-library-item="frame-oval"]')!);
    expect(editor.view.getState().notice).toEqual({ key: "framing.noClips", tone: "error" });
    expect(clips(editor)[0].masks).toBeUndefined();
  });

  it("inserts an animated sticker at the playhead", { timeout: 15_000 }, () => {
    const { editor, container } = renderInEditor(emptyVideoDocument("square"), <ElementsPanel />);
    act(() => editor.view.setState({ playheadMs: 800 }));
    fireEvent.click(container.querySelector<HTMLElement>('[data-library-item="sticker-underline-double"]')!);
    const placed = editor.store.getState().document.tracks.flatMap((track) => track.clips);
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ type: "overlay", startMs: 800, line: { trim: { start: 0, end: 1, offset: 0, sequential: true } } });
  });
});
