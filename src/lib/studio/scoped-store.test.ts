import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "./document";
import { groupClips } from "./group-edits";
import type { GroupPath } from "./group-scope";
import { scopedStore } from "./scoped-store";
import { createStudioStore } from "./store";
import { deleteClips, findClip, updateClip } from "./timeline";

function grouped(): { doc: VideoDocument; groupId: string } {
  const doc = emptyVideoDocument("story");
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "m-a", 0, 2000), id: "a" }, { ...newMediaClip("image", "m-b", 2000, 1000), id: "b" }] }];
  doc.durationMs = 3000;
  const result = groupClips(doc, ["a"]);
  if (!result.ok) throw new Error(result.reason);
  return { doc: result.document, groupId: result.groupId };
}

function scope(initial: GroupPath) {
  let path = initial;
  const listeners = new Set<() => void>();
  return {
    path: () => path,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next: GroupPath) => {
      path = next;
      for (const listener of listeners) listener();
    },
  };
}

describe("scoped editor store", () => {
  it("shows and edits the open group while the history stays on the film", () => {
    const { doc, groupId } = grouped();
    const root = createStudioStore(doc);
    const where = scope([groupId]);
    const scoped = scopedStore(root, where);
    expect(scoped.getState().document.tracks[0].clips.map((clip) => clip.id)).toEqual(["a"]);
    expect(scoped.getState().document).toBe(scoped.getState().document);
    scoped.getState().apply((inner) => updateClip(inner, "a", { volume: 0.25 }));
    expect(scoped.getState().document.tracks[0].clips[0].volume).toBe(0.25);
    expect(findClip(root.getState().document, "a")).toBeNull();
    root.getState().undo();
    expect(scoped.getState().document.tracks[0].clips[0].volume).toBe(1);
    where.set([]);
    expect(scoped.getState().document).toBe(root.getState().document);
  });

  it("tells subscribers when the film or the open group changes", () => {
    const { doc, groupId } = grouped();
    const root = createStudioStore(doc);
    const where = scope([]);
    const scoped = scopedStore(root, where);
    const seen: string[][] = [];
    const stop = scoped.subscribe((state) => seen.push(state.document.tracks.flatMap((track) => track.clips.map((clip) => clip.id))));
    where.set([groupId]);
    root.getState().select(["a"]);
    stop();
    where.set([]);
    expect(seen).toEqual([["a"], ["a"]]);
  });

  it("falls back to the film when the open group is gone", () => {
    const { doc, groupId } = grouped();
    const root = createStudioStore(doc);
    const scoped = scopedStore(root, scope([groupId]));
    root.getState().apply((film) => deleteClips(film, [groupId]));
    expect(scoped.getState().document).toBe(root.getState().document);
    scoped.getState().apply((film) => updateClip(film, "b", { volume: 0.5 }));
    expect(findClip(root.getState().document, "b")?.clip.volume).toBe(0.5);
  });
});
