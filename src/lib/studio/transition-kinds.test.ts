import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "./document";
import { addTransition, findTransition, optionsOf, shownOptions, transitionIssue, updateTransition, visibleOptions, type Transition, type TransitionInput } from "./transitions";
import { documentIssue } from "./validate";

function clip(id: string, startMs: number, durationMs: number, extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("image", `asset-${id}`, startMs, durationMs), id, ...extra };
}

function film(a: Partial<Clip> = {}, b: Partial<Clip> = {}): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [{ id: "v1", kind: "visual", clips: [clip("a", 0, 2000, a), clip("b", 2000, 2000, b)] }];
  d.durationMs = 4000;
  return d;
}

function placed(input: Partial<TransitionInput>, d: VideoDocument = film()): { document: VideoDocument; transition: Transition } {
  const result = addTransition(d, { fromClipId: "a", toClipId: "b", kind: "gradientWipe", ...input });
  if (!result.ok) throw new Error(result.reason);
  return { document: result.document, transition: findTransition(result.document, result.transitionId)!.transition };
}

describe("the new wipe kinds on a cut", () => {
  it("fill their defaults and pass the document contract", () => {
    expect(placed({ kind: "gradientWipe" }).transition).toMatchObject({ kind: "gradientWipe", map: "linear", angle: 0, softness: 0.2, reverse: false, easing: "linear" });
    expect(placed({ kind: "venetianBlinds" }).transition).toMatchObject({ angle: 0, size: 0.1, softness: 0 });
    expect(placed({ kind: "blockDissolve" }).transition).toMatchObject({ size: 0.08, softness: 0 });
    expect(placed({ kind: "radialWipe" }).transition).toMatchObject({ angle: 0, originX: 0.5, originY: 0.5, softness: 0 });
    for (const kind of ["gradientWipe", "venetianBlinds", "blockDissolve", "radialWipe"] as const) expect(documentIssue("video", placed({ kind }).document)).toBeNull();
  });

  it("offer only their own options", () => {
    expect(optionsOf("gradientWipe")).toEqual(["map", "angle", "originX", "originY", "softness", "reverse", "mapAssetId"]);
    expect(optionsOf("blockDissolve")).toEqual(["size", "softness"]);
    expect(addTransition(film(), { fromClipId: "a", toClipId: "b", kind: "venetianBlinds", direction: "left" })).toEqual({ ok: false, reason: "option" });
  });

  it("refuse option values outside their ranges", () => {
    const refused = (input: Partial<TransitionInput>) => addTransition(film(), { fromClipId: "a", toClipId: "b", kind: "gradientWipe", ...input });
    expect(refused({ softness: 1.5 })).toEqual({ ok: false, reason: "option" });
    expect(refused({ map: "spiral" as never })).toEqual({ ok: false, reason: "option" });
    expect(refused({ mapAssetId: "  " })).toEqual({ ok: false, reason: "option" });
    expect(addTransition(film(), { fromClipId: "a", toClipId: "b", kind: "venetianBlinds", size: 0 })).toEqual({ ok: false, reason: "option" });
    expect(addTransition(film(), { fromClipId: "a", toClipId: "b", kind: "venetianBlinds", size: 1.2 })).toEqual({ ok: false, reason: "option" });
  });

  it("keep a picture map and a preset map apart", () => {
    const pictured = placed({ mapAssetId: "m-9" }).transition;
    expect(pictured.mapAssetId).toBe("m-9");
    expect(pictured.map).toBeUndefined();
    const { document, transition } = placed({ mapAssetId: "m-9" });
    const swapped = updateTransition(document, transition.id, { map: "radial" });
    if (!swapped.ok) throw new Error(swapped.reason);
    const preset = findTransition(swapped.document, transition.id)!.transition;
    expect(preset.map).toBe("radial");
    expect(preset).not.toHaveProperty("mapAssetId");
    const back = updateTransition(swapped.document, transition.id, { mapAssetId: "m-2" });
    if (!back.ok) throw new Error(back.reason);
    const picture = findTransition(back.document, transition.id)!.transition;
    expect(picture.mapAssetId).toBe("m-2");
    expect(picture).not.toHaveProperty("map");
    expect(transitionIssue({ ...transition, map: "linear", mapAssetId: "m-1" }, document.tracks[0])).toBe("option");
  });

  it("show only the options the chosen map uses", () => {
    expect(shownOptions({ kind: "gradientWipe" })).toEqual({ map: "linear", angle: 0, softness: 0.2, reverse: false });
    expect(visibleOptions({ kind: "gradientWipe", map: "radial" })).toEqual(["map", "originX", "originY", "softness", "reverse"]);
    expect(shownOptions({ kind: "gradientWipe", mapAssetId: "m-1", reverse: true })).toEqual({ mapAssetId: "m-1", softness: 0.2, reverse: true });
    expect(shownOptions({ kind: "slide" }, ["direction"])).toEqual({ direction: "left" });
  });

  it("take over an edge that had its own entrance or exit transition", () => {
    const covered = film({ transitionOut: { kind: "wipe", durationMs: 400, easing: "linear" } }, { transitionIn: { kind: "iris", durationMs: 400, easing: "linear" } });
    const { document, transition } = placed({ kind: "dissolve" }, covered);
    expect(document.tracks[0].clips.map((c) => [c.transitionOut, c.transitionIn])).toEqual([
      [undefined, undefined],
      [undefined, undefined],
    ]);
    const clashing = { ...document.tracks[0], clips: document.tracks[0].clips.map((c) => (c.id === "b" ? { ...c, transitionIn: { kind: "wipe" as const, durationMs: 300, easing: "linear" as const } } : c)) };
    expect(transitionIssue(transition, clashing)).toBe("covered");
  });
});
