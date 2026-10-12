import { describe, expect, it } from "vitest";

import { blendColor } from "./blend-modes";
import { clipBlend, clipBlendIssue, clipBlendPatch } from "./clip-blend";
import { emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, newTextLayer, type Clip, type VideoDocument } from "./document";
import { newEffectClip } from "./vfx";
import { visualPlan } from "./playback";
import { videoScene } from "./scene/video-scene";
import { documentIssue } from "./validate";

const video = (): Clip => ({ ...newMediaClip("video", "m", 0, 1000), id: "v" });
const text = (): Clip => ({ ...newOverlayClip(newTextLayer("Oi"), 0, 1000), id: "t" });

describe("blend modes on clips", () => {
  it("keeps the mode of media on the clip and of texts and shapes on their layer", () => {
    expect(clipBlend(video())).toBe("normal");
    expect(clipBlend({ ...video(), blendMode: "add" })).toBe("add");
    expect(clipBlend({ ...text(), layer: { ...text().layer!, blendMode: "screen" } })).toBe("screen");
    expect(clipBlendPatch(video(), "multiply")).toEqual({ blendMode: "multiply" });
    const added: Clip = { ...video(), blendMode: "add" };
    expect(clipBlendPatch(added, "normal")).toEqual({ blendMode: undefined });
    expect(clipBlendPatch(text(), "add")?.layer?.blendMode).toBe("add");
    expect(clipBlendPatch(newEffectClip([], 0, 1000), "add")).toBeNull();
  });

  it("refuses an unknown mode and a clip mode on texts, shapes and effect clips", () => {
    expect(clipBlendIssue({ ...video(), blendMode: "add" })).toBeNull();
    expect(clipBlendIssue({ ...video(), blendMode: "glow" as "add" })).toBe("unknown");
    expect(clipBlendIssue({ ...text(), blendMode: "add" })).toBe("invalid");
  });

  it("adds light like a linear dodge clipped at white", () => {
    expect(blendColor("add", [0.25, 0.5, 0.75], [0.5, 0.25, 0.5])).toEqual([0.75, 0.75, 1]);
  });
});

function film(clip: Clip): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.tracks = [
    { id: "a", kind: "visual", clips: [{ ...newOverlayClip(newShapeLayer("rect"), 0, 1000), id: "s" }] },
    { id: "b", kind: "visual", clips: [clip] },
  ];
  doc.durationMs = 1000;
  return doc;
}

describe("clip blend modes in the document and the scene", () => {
  it("passes the document check on media and fails closed on texts", () => {
    expect(documentIssue("video", film({ ...video(), blendMode: "add" }))).toBeNull();
    expect(documentIssue("video", film({ ...text(), blendMode: "add" }))).not.toBeNull();
    expect(documentIssue("video", film({ ...video(), blendMode: "glow" as "add" }))).not.toBeNull();
  });

  it("hands the media blend mode to the renderer", () => {
    const doc = film({ ...video(), blendMode: "screen" });
    expect(videoScene(doc, visualPlan(doc, 500)).nodes[1].blend).toBe("screen");
    const plain = film(video());
    expect(videoScene(plain, visualPlan(plain, 500)).nodes[1].blend).toBeUndefined();
  });
});
