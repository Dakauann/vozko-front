import { describe, expect, it } from "vitest";

import { editClipItem, editClipItems, insertItem, moveItem, removeItem, type ClipItems } from "./clip-items";
import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "./document";
import { findClip } from "./timeline";

interface Tag {
  id: string;
  label: string;
}

type TaggedClip = Clip & { tags?: Tag[] };

const TAGS: ClipItems<Tag> = {
  read: (clip) => (clip as TaggedClip).tags ?? [],
  write: (tags) => ({ tags: tags.length > 0 ? tags : undefined }) as never,
  invalid: (tags) => tags.some((tag) => tag.label === ""),
};

function film(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [
    { id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 2000), id: "c", tags: [{ id: "a", label: "A" }] } as TaggedClip] },
    { id: "s", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 2000), id: "m" }] },
  ];
  d.durationMs = 2000;
  return d;
}

const tagsOf = (d: VideoDocument) => (findClip(d, "c")!.clip as TaggedClip).tags;

describe("clip item lists", () => {
  it("inserts, removes and moves items by id", () => {
    const items = [{ id: "a" }, { id: "b" }];
    expect(insertItem(items, { id: "c" }, 1).map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(insertItem(items, { id: "c" }).map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(removeItem(items, "a")?.map((item) => item.id)).toEqual(["b"]);
    expect(removeItem(items, "x")).toBeNull();
    expect(moveItem(items, "a", 5)?.map((item) => item.id)).toEqual(["b", "a"]);
    expect(moveItem(items, "x", 0)).toBeNull();
  });

  it("edits the list of a visual clip and writes it back", () => {
    const result = editClipItems(film(), "c", TAGS, (tags) => insertItem(tags, { id: "b", label: "B" }));
    if (!result.ok) throw new Error(result.reason);
    expect(tagsOf(result.document)?.map((tag) => tag.id)).toEqual(["a", "b"]);
  });

  it("refuses missing clips, locked tracks, sound clips and lists that would be invalid", () => {
    expect(editClipItems(film(), "x", TAGS, (tags) => tags)).toEqual({ ok: false, reason: "missing" });
    expect(editClipItems(film(), "m", TAGS, (tags) => tags)).toEqual({ ok: false, reason: "notVisual" });
    const locked = film();
    locked.tracks[0].locked = true;
    expect(editClipItems(locked, "c", TAGS, (tags) => tags)).toEqual({ ok: false, reason: "locked" });
    expect(editClipItems(film(), "c", TAGS, () => [{ id: "a", label: "" }])).toEqual({ ok: false, reason: "invalid" });
  });

  it("changes one item and reports a missing one with the caller's reason", () => {
    const result = editClipItem(film(), "c", "a", TAGS, "tagMissing", (tag) => ({ ...tag, label: "Z" }));
    if (!result.ok) throw new Error(result.reason);
    expect(tagsOf(result.document)).toEqual([{ id: "a", label: "Z" }]);
    expect(editClipItem(film(), "c", "q", TAGS, "tagMissing", (tag) => tag)).toEqual({ ok: false, reason: "tagMissing" });
  });
});
