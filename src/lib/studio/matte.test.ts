import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, type Clip, type VideoDocument } from "./document";
import { changedMatte, matteIssue, matteOf, mattePatch, matteWeight, PLAIN_MATTE } from "./matte";
import { visualPlan } from "./playback";
import { videoScene } from "./scene/video-scene";
import { documentIssue } from "./validate";

const base = (): Clip => ({ ...newMediaClip("image", "m", 0, 1000), id: "c" });

describe("matte settings", () => {
  it("reads a plain matte from the old switch and the channel and invert from the new fields", () => {
    expect(matteOf(base())).toBeNull();
    expect(matteOf({ ...base(), matte: true })).toEqual(PLAIN_MATTE);
    expect(matteOf({ ...base(), matte: true, matteChannel: "luma", matteInvert: true })).toEqual({ channel: "luma", invert: true });
  });

  it("writes only what differs from a plain matte and clears everything when off", () => {
    expect(mattePatch({ channel: "alpha", invert: false })).toEqual({ matte: true, matteChannel: undefined, matteInvert: undefined });
    expect(mattePatch({ channel: "luma", invert: true })).toEqual({ matte: true, matteChannel: "luma", matteInvert: true });
    expect(mattePatch(null)).toEqual({ matte: undefined, matteChannel: undefined, matteInvert: undefined });
  });

  it("changes one part at a time and turns the matte on when a part is set", () => {
    expect(changedMatte(null, { channel: "luma" })).toEqual({ channel: "luma", invert: false });
    expect(changedMatte({ channel: "luma", invert: false }, { invert: true })).toEqual({ channel: "luma", invert: true });
    expect(changedMatte({ channel: "luma", invert: true }, { on: false })).toBeNull();
    expect(changedMatte(null, { on: true })).toEqual(PLAIN_MATTE);
  });

  it("refuses a channel or invert without the matte and an unknown channel", () => {
    expect(matteIssue({ matteChannel: "luma" })).toBe("invalid");
    expect(matteIssue({ matteInvert: true })).toBe("invalid");
    expect(matteIssue({ matte: true, matteChannel: "red" as "luma" })).toBe("unknown");
    expect(matteIssue({ matte: true, matteChannel: "alpha", matteInvert: false })).toBeNull();
  });
});

describe("matte weight", () => {
  it("takes the alpha or the luma of the premultiplied picture below, inverted on request", () => {
    expect(matteWeight({ channel: "alpha", invert: false }, [0, 0, 0.5, 0.5])).toBeCloseTo(0.5);
    expect(matteWeight({ channel: "alpha", invert: true }, [0, 0, 0.5, 0.5])).toBeCloseTo(0.5);
    expect(matteWeight({ channel: "alpha", invert: true }, [1, 1, 1, 1])).toBeCloseTo(0);
    expect(matteWeight({ channel: "luma", invert: false }, [1, 0, 0, 1])).toBeCloseTo(0.2126);
    expect(matteWeight({ channel: "luma", invert: true }, [0, 1, 0, 1])).toBeCloseTo(1 - 0.7152);
    expect(matteWeight({ channel: "luma", invert: false }, [0, 0, 0, 0])).toBe(0);
  });
});

function matteFilm(member: Partial<Clip>): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.tracks = [
    { id: "v1", kind: "visual", clips: [base()] },
    { id: "v2", kind: "visual", clips: [{ ...newOverlayClip(newShapeLayer("rect"), 0, 1000), id: "m", ...member }] },
  ];
  doc.durationMs = 1000;
  return doc;
}

describe("mattes on the timeline", () => {
  it("passes the document check with a channel and invert, and fails closed on loose parts", () => {
    expect(documentIssue("video", matteFilm({ matte: true, matteChannel: "luma", matteInvert: true }))).toBeNull();
    expect(documentIssue("video", matteFilm({ matteChannel: "luma" }))).not.toBeNull();
    expect(documentIssue("video", matteFilm({ matte: true, matteChannel: "red" as "luma" }))).not.toBeNull();
  });

  it("hands the matte settings to the scene next to the clip it is cut by", () => {
    const doc = matteFilm({ matte: true, matteChannel: "luma", matteInvert: true });
    const nodes = videoScene(doc, visualPlan(doc, 500)).nodes;
    expect(nodes[1].clipOf).toBe("c");
    expect(nodes[1].clipMatte).toEqual({ channel: "luma", invert: true });
    const plain = videoScene(matteFilm({ matte: true }), visualPlan(matteFilm({ matte: true }), 500)).nodes;
    expect(plain[1].clipOf).toBe("c");
    expect(plain[1].clipMatte).toBeUndefined();
  });
});
