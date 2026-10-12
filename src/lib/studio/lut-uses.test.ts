import { describe, expect, it } from "vitest";

import { emptyArtboard, emptyVideoDocument, newImageLayer, newMediaClip, type Clip, type VideoDocument } from "./document";
import { firstUnreadableLut, lutSpanOf, surfaceLutUses, videoLutUses } from "./lut-uses";

function film(clips: Clip[]): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  doc.tracks = [{ id: "v1", kind: "visual", clips }];
  doc.durationMs = 10_000;
  return doc;
}

const looked = (id: string, startMs: number, assetId: string, intensity?: number): Clip => ({
  ...newMediaClip("video", "film", startMs, 1000),
  id,
  color: { lut: { assetId, ...(intensity !== undefined ? { intensity } : {}) } },
});

describe("LUT uses", () => {
  it("lists the clips that apply a LUT, skipping neutral, disabled and hidden ones and clips outside the span", () => {
    const doc = film([looked("a", 0, "warm"), looked("b", 1000, "cold", 0), { ...looked("c", 2000, "teal"), disabled: true }, looked("d", 3000, "warm")]);
    doc.tracks.push({ id: "v2", kind: "visual", hidden: true, clips: [looked("e", 0, "hidden")] });
    expect(videoLutUses(doc).map((use) => [use.owner.kind === "clip" ? use.owner.clip.id : "", use.assetId])).toEqual([
      ["a", "warm"],
      ["d", "warm"],
    ]);
    expect(videoLutUses(doc, lutSpanOf([3500])).map((use) => use.assetId)).toEqual(["warm"]);
    expect(videoLutUses(doc, { startMs: 1000, endMs: 3000 })).toEqual([]);
  });

  it("finds LUTs on effect clips and inside group clips", () => {
    const effect: Clip = { ...looked("fx", 0, "grade"), type: "effect", assetId: undefined };
    const group: Clip = { ...newMediaClip("video", "x", 0, 1000), id: "g", type: "group", assetId: undefined, tracks: [{ id: "inner", kind: "visual", clips: [looked("inside", 0, "nested")] }] };
    expect(videoLutUses(film([effect])).map((use) => use.assetId)).toEqual(["grade"]);
    expect(videoLutUses({ tracks: [{ id: "v", kind: "visual", clips: [group] }] }).map((use) => use.assetId)).toEqual(["nested"]);
  });

  it("lists visible image layers with a LUT", () => {
    const artboard = emptyArtboard({ width: 100, height: 100 });
    artboard.layers = [{ ...newImageLayer("photo"), id: "p", color: { lut: { assetId: "warm" } } }, { ...newImageLayer("photo"), id: "h", hidden: true, color: { lut: { assetId: "cold" } } }];
    expect(surfaceLutUses(artboard).map((use) => (use.owner.kind === "layer" ? use.owner.layer.id : ""))).toEqual(["p"]);
  });

  it("returns the first use whose LUT cannot be read, asking once per LUT", async () => {
    const asked: string[] = [];
    const readable = async (id: string) => {
      asked.push(id);
      return id !== "cold";
    };
    const uses = videoLutUses(film([looked("a", 0, "warm"), looked("b", 1000, "cold"), looked("c", 2000, "cold")]));
    const blocked = await firstUnreadableLut(uses, readable);
    expect(blocked?.owner.kind === "clip" ? blocked.owner.clip.id : null).toBe("b");
    expect(asked.sort()).toEqual(["cold", "warm"]);
    expect(await firstUnreadableLut(uses.slice(0, 1), readable)).toBeNull();
  });
});
