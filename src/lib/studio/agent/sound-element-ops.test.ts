import { describe, expect, it } from "vitest";

import { emptyVideoDocument, fullFrame } from "../document";
import { AUDIO_CATEGORY } from "../library/builtin/sounds";
import { itemIndex, loadAllItems } from "../library/store";
import { findClip } from "../timeline";
import { parseDocument } from "../validate";
import { planBatch } from "./batch";
import type { LibraryLookup } from "./element-ops";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

const LIBRARY: LibraryLookup = { items: itemIndex(await loadAllItems([AUDIO_CATEGORY])), text: (label) => ("key" in label ? label.key : label.text.pt), locale: "pt-BR" };

const CTX: VideoOpContext = {
  playheadMs: 0,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => undefined,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
  library: LIBRARY,
};

function run(ops: VideoOperation[], start = emptyVideoDocument("story")) {
  return planBatch(start, ops, (doc, op) => applyVideoOperation(doc, op, CTX), VIDEO_ID_FIELDS, videoIds);
}

describe("Elo inserts built-in sounds through add_element", () => {
  it("puts the sound on an audio track at at_ms with its own length", () => {
    const plan = run([{ op: "add_element", ref: "plim", item_id: "sound-ding", at_ms: 2000 }]);
    if (!plan.ok) throw new Error(plan.reason);
    const found = findClip(plan.final, plan.created.plim[0])!;
    expect(found.track.kind).toBe("audio");
    expect(found.clip).toMatchObject({ type: "audio", assetId: "sound:ding", startMs: 2000, durationMs: 1400 });
    expect(parseDocument("video", plan.final).ok).toBe(true);
  });

  it("keeps the sound on the asked audio track and never moves it like a picture", () => {
    const start = emptyVideoDocument("story");
    const audio = start.tracks.find((track) => track.kind === "audio")!;
    const plan = run([{ op: "add_element", ref: "pop", item_id: "sound-pop", track_id: audio.id, x: 0.1, y: 0.9 }], start);
    if (!plan.ok) throw new Error(plan.reason);
    const found = findClip(plan.final, plan.created.pop[0])!;
    expect(found.track.id).toBe(audio.id);
    expect(found.clip.transform).toEqual(fullFrame());
  });

  it("moves a sound asked onto a picture track to an audio track", () => {
    const start = emptyVideoDocument("story");
    const plan = run([{ op: "add_element", ref: "pop", item_id: "sound-pop", track_id: start.tracks[0].id }], start);
    if (!plan.ok) throw new Error(plan.reason);
    expect(findClip(plan.final, plan.created.pop[0])!.track.kind).toBe("audio");
  });
});
