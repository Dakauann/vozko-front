import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newNullClip, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "./document";
import { groupClips } from "./group-edits";
import { cleanClipName, exportedDocument, guideCount, shownTracks, shyCount } from "./organize";
import { findClip } from "./timeline";
import { documentIssue, parseDocument } from "./validate";

function film(clips: Clip[], extra: Partial<VideoDocument> = {}): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.tracks = [
    { id: "v1", kind: "visual", clips },
    { id: "a1", kind: "audio", clips: [] },
  ];
  doc.durationMs = 10_000;
  return { ...doc, ...extra };
}

describe("timeline organization", () => {
  it("accepts names, label colors and guides on any clip and label colors and shy on tracks", () => {
    const photo: Clip = { ...newMediaClip("image", "m-1", 0, 2000), id: "photo", name: "Foto da loja", labelColor: "green", guide: true };
    const rig: Clip = { ...newNullClip(2000, 1000), id: "rig", name: "Controle", labelColor: "blue" };
    const doc = film([photo, rig]);
    doc.tracks[0] = { ...doc.tracks[0], labelColor: "purple", shy: true };
    expect(documentIssue("video", doc)).toBeNull();
  });

  it("refuses blank or long names, unknown label colors and guides on nulls", () => {
    const photo: Clip = { ...newMediaClip("image", "m-1", 0, 2000), id: "photo" };
    expect(documentIssue("video", film([{ ...photo, name: "   " }]))?.code).toBe("invalid");
    expect(documentIssue("video", film([{ ...photo, name: "a".repeat(129) }]))?.code).toBe("too_large");
    expect(documentIssue("video", film([{ ...photo, labelColor: "teal" as never }]))?.code).toBe("unknown");
    expect(documentIssue("video", film([{ ...newNullClip(0, 1000), id: "rig", guide: true }]))?.code).toBe("invalid");
    const doc = film([photo]);
    doc.tracks[0] = { ...doc.tracks[0], labelColor: "teal" as never };
    expect(documentIssue("video", doc)?.code).toBe("unknown");
  });

  it("turns guides off only for the export, inside groups too", () => {
    const guide: Clip = { ...newOverlayClip(newTextLayer("safe area"), 0, 2000), id: "guide", guide: true };
    const kept: Clip = { ...newMediaClip("image", "m-1", 0, 2000), id: "kept" };
    const doc = film([guide], { tracks: [{ id: "v1", kind: "visual", clips: [guide] }, { id: "v2", kind: "visual", clips: [kept] }] });
    const grouped = groupClips(doc, ["guide", "kept"]);
    if (!grouped.ok) throw new Error(grouped.reason);
    expect(guideCount(grouped.document)).toBe(1);
    const exported = exportedDocument(grouped.document);
    const group = findClip(exported, grouped.groupId)!.clip;
    const inner = group.tracks!.flatMap((track) => track.clips);
    expect(inner.find((clip) => clip.id === "guide")?.disabled).toBe(true);
    expect(inner.find((clip) => clip.id === "kept")?.disabled).toBeUndefined();
    expect(exportedDocument(film([kept]))).toEqual(film([kept]));
  });

  it("hides shy tracks from the timeline view unless asked, keeping a focused one", () => {
    const tracks = [
      { id: "a", shy: true },
      { id: "b" },
      { id: "c", shy: true },
    ];
    expect(shownTracks(tracks, false).map((t) => t.id)).toEqual(["b"]);
    expect(shownTracks(tracks, false, "c").map((t) => t.id)).toEqual(["b", "c"]);
    expect(shownTracks(tracks, true).map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(shyCount(tracks)).toBe(2);
  });

  it("cleans clip names", () => {
    expect(cleanClipName("  Logo  ")).toBe("Logo");
    expect(cleanClipName("   ")).toBeUndefined();
  });

  describe("shared fixture", () => {
    const raw = () => JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_organize.json"), "utf8"));

    it("accepts the document the backend accepts", () => {
      const parsed = parseDocument("video", raw());
      expect(parsed.ok).toBe(true);
    });

    it.each([
      ["an unknown track label", "document.tracks", "unknown", (d: VideoDocument) => (d.tracks[0].labelColor = "teal" as never)],
      ["an unknown clip label", "document.tracks", "unknown", (d: VideoDocument) => (d.tracks[0].clips[0].labelColor = "teal" as never)],
      ["a blank clip name", "document.tracks", "invalid", (d: VideoDocument) => (d.tracks[0].clips[0].name = "   ")],
      ["a long clip name", "document.tracks", "too_large", (d: VideoDocument) => (d.tracks[2].clips[0].name = "a".repeat(129))],
      ["a guide null", "document.tracks", "invalid", (d: VideoDocument) => (d.tracks[2].clips[0].guide = true)],
      ["two clip markers with one id", "document.tracks", "duplicate", (d: VideoDocument) => (d.tracks[3].clips[0].markers![1].id = "b1")],
      ["an unknown clip marker color", "document.tracks", "unknown", (d: VideoDocument) => (d.tracks[3].clips[0].markers![0].color = "teal" as never)],
      ["a negative clip marker", "document.tracks", "out_of_range", (d: VideoDocument) => (d.tracks[3].clips[0].markers![0].atMs = -1)],
      ["a negative marker range", "document.markers", "out_of_range", (d: VideoDocument) => (d.markers![0].durationMs = -5)],
      ["a marker range past the end", "document.markers", "out_of_range", (d: VideoDocument) => (d.markers![1].durationMs = 600_000)],
      ["a long marker note", "document.markers", "too_large", (d: VideoDocument) => (d.markers![1].note = "a".repeat(1001))],
      ["an unknown marker color", "document.markers", "unknown", (d: VideoDocument) => (d.markers![0].color = "teal" as never)],
      ["an inner clip marker out of range", "document.tracks", "out_of_range", (d: VideoDocument) => (d.tracks[0].clips[1].tracks![0].clips[0].markers![0].durationMs = 9_600_000)],
    ])("refuses %s like the backend", (_name, field, code, edit) => {
      const doc = raw() as VideoDocument;
      edit(doc);
      expect(documentIssue("video", doc)).toMatchObject({ field, code });
    });
  });
});
