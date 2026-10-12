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
import { isGroupClip } from "@/lib/studio/group-scope";
import { findClip } from "@/lib/studio/timeline";
import { videoExtraActionFor } from "@/lib/studio/video-shortcuts";

import { Inspector } from "../inspector/inspector";
import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

const pt = ptMessages.studio.video.groups;

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img-a", 0, 2000), id: "a" }, { ...newMediaClip("image", "img-b", 2000, 2000), id: "b" }] },
    { id: "v2", kind: "visual", clips: [{ ...newMediaClip("image", "img-c", 1000, 2000), id: "c", transform: { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 } }] },
  ];
  d.durationMs = 4000;
  return d;
}

function rootGroup(editor: ReturnType<typeof renderInEditor>["editor"]) {
  return editor.root.getState().document.tracks.flatMap((track) => track.clips).find(isGroupClip)!;
}

describe("groups by hand", () => {
  it("groups the selection, opens it to edit inside, goes back and ungroups from the inspector", { timeout: 15_000 }, () => {
    const { editor, container } = renderInEditor(doc(), (
      <>
        <Timeline />
        <Inspector />
      </>
    ));
    act(() => editor.store.getState().select(["b", "c"]));
    act(() => void editor.commands.groupSelection());
    const group = rootGroup(editor);
    expect(group.tracks.flatMap((track) => track.clips.map((clip) => clip.id)).sort()).toEqual(["b", "c"]);
    expect(editor.store.getState().selection).toEqual([group.id]);

    fireEvent.change(screen.getByLabelText(ptMessages.studio.video.organize.name), { target: { value: "Abertura" } });
    fireEvent.blur(screen.getByLabelText(ptMessages.studio.video.organize.name));
    expect(rootGroup(editor).name).toBe("Abertura");

    fireEvent.doubleClick(container.querySelector(`[data-clip-id="${group.id}"]`)!);
    expect(editor.view.getState().groupPath).toEqual([group.id]);
    expect(screen.getByRole("navigation", { name: pt.breadcrumb })).toBeTruthy();
    expect(container.querySelector('[data-clip-id="b"]')).not.toBeNull();
    expect(container.querySelector('[data-clip-id="a"]')).toBeNull();

    act(() => editor.store.getState().apply((inner) => ({ ...inner, tracks: inner.tracks.map((track) => ({ ...track, clips: track.clips.map((clip) => (clip.id === "c" ? { ...clip, volume: 0.5 } : clip)) })) })));
    expect(findClip(editor.root.getState().document, "c")).toBeNull();
    expect(rootGroup(editor).tracks.flatMap((track) => track.clips).find((clip) => clip.id === "c")?.volume).toBe(0.5);

    fireEvent.click(screen.getByRole("button", { name: pt.back }));
    expect(editor.view.getState().groupPath).toEqual([]);
    expect(editor.store.getState().selection).toEqual([group.id]);

    fireEvent.click(screen.getByRole("button", { name: pt.ungroup }));
    expect(findClip(editor.root.getState().document, "b")!.clip.startMs).toBe(2000);
    expect(findClip(editor.root.getState().document, "c")!.clip.startMs).toBe(1000);
    expect(editor.root.getState().document.tracks.some((track) => track.clips.some(isGroupClip))).toBe(false);
  });

  it("explains a refused grouping instead of changing the film", { timeout: 15_000 }, () => {
    const d = doc();
    d.tracks.push({ id: "v3", kind: "visual", clips: [{ ...newMediaClip("image", "img-d", 0, 4000), id: "d" }] });
    const { editor } = renderInEditor(d, <Timeline />);
    const before = editor.root.getState().document;
    act(() => editor.store.getState().select(["a", "d"]));
    act(() => void editor.commands.groupSelection());
    expect(editor.root.getState().document).toBe(before);
    expect(editor.view.getState().notice).toEqual({ key: "groups.interleaved", tone: "error" });
  });

  it("maps the group keys", () => {
    const stroke = (key: string, extra: Partial<KeyboardEvent> = {}) => ({ key, code: `Key${key.toUpperCase()}`, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, target: null, ...extra }) as unknown as KeyboardEvent;
    expect(videoExtraActionFor(stroke("g", { ctrlKey: true }))).toEqual({ type: "group" });
    expect(videoExtraActionFor(stroke("G", { ctrlKey: true, shiftKey: true }))).toEqual({ type: "ungroup" });
    expect(videoExtraActionFor({ ...stroke("Enter"), code: "Enter" } as KeyboardEvent)).toEqual({ type: "openGroup" });
    expect(videoExtraActionFor({ ...stroke("Enter", { shiftKey: true }), code: "Enter" } as KeyboardEvent)).toEqual({ type: "closeGroup" });
  });
});
