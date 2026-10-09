import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "./document";
import { KEYFRAME_LIMITS, valueAt, type Keyframes } from "./keyframes";
import { duplicateClips, findClip, insertClip, splitClip, timelineKeyframeCount, trimClipStart, updateClip } from "./timeline";
import { parseDocument } from "./validate";

const asset = "11111111-1111-4111-8111-111111111111";

function withClip(keyframes?: Keyframes): { doc: VideoDocument; clipId: string } {
  const empty = emptyVideoDocument("story");
  const clip = { ...newMediaClip("image", asset, 0, 4000), keyframes };
  const result = insertClip(empty, empty.tracks[0].id, clip);
  return { doc: result.document, clipId: result.clipId! };
}

const slide: Keyframes = {
  x: [
    { atMs: 0, value: 0, easing: "linear" },
    { atMs: 1000, value: 0.2, easing: "linear" },
    { atMs: 3000, value: 0.6, easing: "linear" },
    { atMs: 4000, value: 0.8, easing: "linear" },
  ],
};

function full(count: number, spacingMs = 10): Keyframes {
  return { x: Array.from({ length: count }, (_, i) => ({ atMs: i * spacingMs, value: 0.5, easing: "linear" as const })) };
}

describe("keyframes follow timeline edits", () => {
  it("keeps keys on the same content when the start is trimmed", () => {
    const { doc, clipId } = withClip(slide);
    const trimmed = trimClipStart(doc, clipId, 1000);
    expect(findClip(trimmed, clipId)?.clip.keyframes?.x?.map((f) => f.atMs)).toEqual([-1000, 0, 2000, 3000]);
    expect(parseDocument("video", JSON.parse(JSON.stringify(trimmed))).ok).toBe(true);
  });

  it("splits the animation so both halves move exactly as before", () => {
    const { doc, clipId } = withClip(slide);
    const { document, clipId: rightId } = splitClip(doc, clipId, 2000);
    const left = findClip(document, clipId)!.clip;
    const right = findClip(document, rightId!)!.clip;
    expect(left.keyframes?.x?.map((f) => f.atMs)).toEqual([0, 1000, 3000]);
    expect(right.keyframes?.x?.map((f) => f.atMs)).toEqual([-1000, 1000, 2000]);
    for (const at of [0, 500, 1500, 1999]) expect(valueAt(left.keyframes!.x!, at)).toBeCloseTo(valueAt(slide.x!, at), 12);
    for (const at of [0, 500, 1500, 1999]) expect(valueAt(right.keyframes!.x!, at)).toBeCloseTo(valueAt(slide.x!, at + 2000), 12);
    expect(parseDocument("video", JSON.parse(JSON.stringify(document))).ok).toBe(true);
  });

  it("keeps animating clips without a timeline-wide keyframe budget", () => {
    const per = KEYFRAME_LIMITS.perProperty;
    let doc = emptyVideoDocument("story");
    for (let at = 0; at < 30_000; at += 1000) doc = insertClip(doc, doc.tracks[0].id, { ...newMediaClip("image", asset, at, 1000), keyframes: full(per) }).document;
    expect(timelineKeyframeCount(doc)).toBe(30 * per);
    const last = doc.tracks[0].clips.at(-1)!.id;
    expect(duplicateClips(doc, [last]).clipIds).toHaveLength(1);
    expect(splitClip(doc, last, 29_450).clipId).not.toBeNull();
    const plain = insertClip(doc, doc.tracks[1].id, newMediaClip("image", asset, 0, 1000));
    expect(updateClip(plain.document, plain.clipId!, { keyframes: full(per) })).not.toBe(plain.document);
    expect(parseDocument("video", JSON.parse(JSON.stringify(doc))).ok).toBe(true);
  });
});
