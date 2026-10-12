import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { carriesTilt, clipTiltAt, perspectiveIssue, perspectiveOf, sceneLens, takesTilt, tiltAt, tiltIssue, tiltMatrix, tiltPivot, tiltStaticPatch, tiltStaticValue } from "./clip-tilt";
import { emptyVideoDocument, newMediaClip, newNullClip, type Clip, type VideoDocument } from "./document";
import { documentIssue } from "./validate";
import { DEFAULT_PERSPECTIVE, projectHomography, tiltHomography } from "./perspective";

function image(patch: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("image", "m-1", 0, 2000), id: "c-1", ...patch };
}

describe("which clips turn in depth", () => {
  it("takes pictures, texts and groups but not sound, nulls or effect clips", () => {
    expect(["video", "image", "overlay", "group"].every((type) => takesTilt(type as Clip["type"]))).toBe(true);
    expect(["audio", "null", "effect"].some((type) => takesTilt(type as Clip["type"]))).toBe(false);
  });

  it("refuses a turn on a clip type that has no picture of its own", () => {
    expect(tiltIssue({ ...image({ rotationY: 30 }), type: "null" })).toBe("invalid");
    expect(tiltIssue({ ...image(), type: "effect", keyframes: { rotationX: [{ atMs: 0, value: 10, easing: "linear" }] } })).toBe("invalid");
  });

  it("keeps the static turn inside the key range", () => {
    expect(tiltIssue(image({ rotationX: 3600, rotationY: -3600 }))).toBeNull();
    expect(tiltIssue(image({ rotationX: 3601 }))).toBe("out_of_range");
    expect(tiltIssue(image({ rotationY: Number.NaN }))).toBe("out_of_range");
  });
});

describe("the turn at a moment", () => {
  it("reads the static value when there are no keys", () => {
    expect(tiltAt(image({ rotationY: 45 }), 500)).toEqual({ x: 0, y: 45 });
  });

  it("lets the keys win over the static value", () => {
    const clip = image({ rotationY: 45, keyframes: { rotationY: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 180, easing: "linear" }] } });
    expect(tiltAt(clip, 500)).toEqual({ x: 0, y: 90 });
    expect(carriesTilt(clip)).toBe(true);
  });

  it("is nothing for a level clip or a clip that cannot turn", () => {
    expect(clipTiltAt(image(), 0)).toBeNull();
    expect(clipTiltAt(image({ rotationX: 360 }), 0)).toBeNull();
    expect(clipTiltAt({ ...image({ rotationX: 20 }), type: "audio" }, 0)).toBeNull();
    expect(clipTiltAt(image({ rotationX: 20, anchor: { x: 0, y: 1 } }), 0)).toEqual({ x: 20, y: 0, anchor: { x: 0, y: 1 } });
  });

  it("stores zero as absent", () => {
    expect(tiltStaticPatch("rotationX", 0)).toEqual({ rotationX: undefined });
    expect(tiltStaticPatch("rotationY", 12)).toEqual({ rotationY: 12 });
    expect(tiltStaticValue(image(), "rotationY")).toBe(0);
  });
});

describe("the project perspective", () => {
  it("defaults to forty degrees and keeps zero as a flat lens", () => {
    expect(perspectiveOf({})).toBe(DEFAULT_PERSPECTIVE);
    expect(perspectiveOf({ perspective: 0 })).toBe(0);
    expect(sceneLens({ perspective: 0 }, { width: 100, height: 100 }).distance).toBe(Infinity);
  });

  it("refuses an angle outside 0 to 120 degrees", () => {
    expect(perspectiveIssue({ perspective: 120 })).toBeNull();
    expect(perspectiveIssue({ perspective: 121 })).toBe("out_of_range");
    expect(perspectiveIssue({ perspective: -1 })).toBe("out_of_range");
  });
});

describe("the matrix of a drawn clip", () => {
  const lens = sceneLens({}, { width: 1000, height: 500 });

  it("turns around the anchor point of the drawn box", () => {
    const box = { x: 400, y: 250, width: 200, height: 100, rotation: 90 };
    const pivot = tiltPivot(box, { x: 1, y: 0.5 });
    expect(pivot.x).toBeCloseTo(400, 9);
    expect(pivot.y).toBeCloseTo(350, 9);
    const matrix = tiltMatrix(lens, box, { x: 0, y: 50, anchor: { x: 1, y: 0.5 } });
    expect(matrix).toEqual(tiltHomography(lens, pivot, { x: 0, y: 50 }));
    const still = projectHomography(matrix, pivot)!;
    expect(still.x).toBeCloseTo(400, 9);
    expect(still.y).toBeCloseTo(350, 9);
  });
});

describe("turns in the document", () => {
  const fixture = () => JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_tilt.json"), "utf8")) as VideoDocument;

  it("accepts the shared fixture, a flat lens included", () => {
    const doc = fixture();
    expect(doc.canvas.perspective).toBe(0);
    expect(documentIssue("video", doc)).toBeNull();
  });

  it("refuses turns on clips without a picture and a lens outside its range", () => {
    const doc = fixture();
    doc.tracks.push({ id: "rig", kind: "visual", clips: [{ ...newNullClip(0, 1000), id: "n", rotationY: 20 }] });
    expect(documentIssue("video", doc)).toEqual({ field: "document.tracks", code: "invalid" });
    const wide = emptyVideoDocument("landscape");
    wide.canvas.perspective = 121;
    expect(documentIssue("video", wide)).toEqual({ field: "document.canvas", code: "out_of_range" });
  });

  it("refuses a letter flip past ten turns", () => {
    const doc = fixture();
    const title = doc.tracks[3].clips[0];
    title.textAnimators![0].properties.rotationY = 3601;
    expect(documentIssue("video", doc)).toEqual({ field: "document.tracks", code: "out_of_range" });
  });
});
