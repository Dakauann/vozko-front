import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 3000), id: "a" }] },
    { id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 3000), id: "m" }] },
  ];
  d.durationMs = 3000;
  return d;
}

function gainLine(): Element {
  return document.querySelector('[data-clip-id="m"] [data-gain-line]') as Element;
}

describe("the volume line on audio clips", () => {
  it("draws the line only on audio clips and drags the clip volume with it", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    const song = () => findClip(editor.store.getState().document, "m")!.clip;
    expect(gainLine()).not.toBeNull();
    expect(document.querySelector('[data-clip-id="a"] [data-gain-line]')).toBeNull();
    fireEvent.pointerDown(gainLine(), { button: 0, pointerId: 1, clientX: 60, clientY: 10 });
    fireEvent.pointerMove(gainLine(), { pointerId: 1, clientX: 60, clientY: 16 });
    fireEvent.pointerMove(gainLine(), { pointerId: 1, clientX: 60, clientY: 22 });
    expect(document.querySelector('[data-clip-id="m"] [role="status"]')?.textContent).toMatch(/-\d+\.\d dB/);
    fireEvent.pointerUp(gainLine(), { pointerId: 1, clientX: 60, clientY: 22 });
    expect(song().volume).toBeLessThan(1);
    expect(song().keyframes?.gainDb).toBeUndefined();
    expect(editor.store.getState().selection).toEqual(["m"]);
  });

  it("adds a key with Alt click, nudges and deletes it from the keyboard", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    const keys = () => findClip(editor.store.getState().document, "m")!.clip.keyframes?.gainDb ?? [];
    fireEvent.pointerDown(gainLine(), { button: 0, pointerId: 1, altKey: true, clientX: 89, clientY: 10 });
    fireEvent.pointerUp(gainLine(), { pointerId: 1, clientX: 89, clientY: 10 });
    expect(keys()).toEqual([{ atMs: 1500, value: 0, easing: "linear" }]);
    const key = screen.getByRole("button", { name: "Chave de volume em 0:01.15: 0.0 dB" });
    fireEvent.keyDown(key, { key: "ArrowDown" });
    expect(keys()[0].value).toBe(-1);
    fireEvent.keyDown(screen.getByRole("button", { name: /Chave de volume em 0:01.15/ }), { key: "Delete" });
    expect(keys()).toEqual([]);
    expect(findClip(editor.store.getState().document, "m")).toBeDefined();
  });

  it("removes a key from its right click menu", { timeout: 15_000 }, () => {
    const d = doc();
    d.tracks[1].clips[0].keyframes = { gainDb: [{ atMs: 1000, value: -6, easing: "linear" }, { atMs: 2000, value: 0, easing: "linear" }] };
    const { editor } = renderInEditor(d, <Timeline />);
    fireEvent.contextMenu(screen.getByRole("button", { name: "Chave de volume em 0:01.00: -6.0 dB" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Remover quadro-chave/ }));
    expect(findClip(editor.store.getState().document, "m")!.clip.keyframes?.gainDb?.map((key) => key.atMs)).toEqual([2000]);
  });
});
