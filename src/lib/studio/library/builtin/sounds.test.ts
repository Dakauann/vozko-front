import { describe, expect, it } from "vitest";

import { BUILTIN_SOUNDS, soundAssetId } from "../../builtin-sounds";
import { emptyVideoDocument, fullFrame, VIDEO_ASPECT_SIZES } from "../../document";
import { DEFAULT_STILL_MS } from "../../media-clips";
import { parseDocument } from "../../validate";
import { insertVideoClips, videoClips, type LibraryClipRequest } from "../instantiate";
import { LIBRARY_ID_PATTERN, type LibraryItem } from "../model";
import { AUDIO_CATEGORY, mediaSoundItem } from "./sounds";

const MEDIA_ID = "6f1d3b8e-2c4a-4f1e-9a7b-0c1d2e3f4a5b";

function request(atMs: number, box?: LibraryClipRequest["box"]): LibraryClipRequest {
  return { canvas: VIDEO_ASPECT_SIZES.square, locale: "pt", text: () => "", atMs, documentMs: 0, ...(box ? { box } : {}) };
}

function items(): readonly LibraryItem[] {
  return AUDIO_CATEGORY.items() as readonly LibraryItem[];
}

describe("Áudios library category", () => {
  it("offers every built-in sound as a video item with a playable preview", () => {
    expect(items().map((item) => item.id).sort()).toEqual(BUILTIN_SOUNDS.map((sound) => `sound-${sound.id}`).sort());
    for (const item of items()) {
      expect(LIBRARY_ID_PATTERN.test(item.id)).toBe(true);
      expect(item.editors).toEqual(["video"]);
      expect(item.template.kind).toBe("clips");
      expect(item.preview.kind).toBe("sound");
      expect(AUDIO_CATEGORY.subcategories?.some((sub) => sub.id === item.subcategory)).toBe(true);
    }
  });

  it("builds one audio clip of the sound's own length at the playhead", () => {
    const sound = BUILTIN_SOUNDS.find((candidate) => candidate.id === "whoosh")!;
    const clips = videoClips(items().find((item) => item.id === "sound-whoosh")!, request(1200))!;
    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({ type: "audio", assetId: soundAssetId("whoosh"), startMs: 1200, durationMs: sound.durationMs });
  });

  it("lands on an audio track and keeps the document valid, even when dropped on the frame", () => {
    const doc = emptyVideoDocument("square");
    const clips = videoClips(items().find((item) => item.id === "sound-pop")!, request(0, { x: 0.2, y: 0.8 }))!;
    expect(clips[0].transform).toEqual(fullFrame());
    const placed = insertVideoClips(doc, clips)!;
    const track = placed.document.tracks.find((candidate) => candidate.clips.some((clip) => clip.id === placed.ids[0]))!;
    expect(track.kind).toBe("audio");
    expect(parseDocument("video", placed.document).ok).toBe(true);
  });

  it("turns a library audio into an item that uses its measured length", () => {
    const measured: { ms?: number } = {};
    const item = mediaSoundItem({ id: MEDIA_ID, description: "Trilha" }, { durationMs: () => measured.ms, assets: { loaded: () => true, load: async () => undefined } })!;
    expect(item.id).toBe(`media-${MEDIA_ID}`);
    expect(item.subcategory).toBe("mine");
    expect(item.label).toEqual({ text: { pt: "Trilha", en: "Trilha", es: "Trilha", de: "Trilha" } });
    expect(videoClips(item, request(0))![0]).toMatchObject({ assetId: MEDIA_ID, durationMs: DEFAULT_STILL_MS });
    measured.ms = 4321;
    expect(videoClips(item, request(500))![0]).toMatchObject({ assetId: MEDIA_ID, startMs: 500, durationMs: 4321 });
  });

  it("skips a library audio whose id cannot name a library item", () => {
    expect(mediaSoundItem({ id: "Not An Id", description: "x" }, { durationMs: () => 1000, assets: { loaded: () => true, load: async () => undefined } })).toBeNull();
  });
});
