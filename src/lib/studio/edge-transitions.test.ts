import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "./document";
import { coveringTransition, EDGE_TRANSITION_KINDS, edgeChoiceOf, edgeChoicePatch, edgePartAt, edgeTransition, edgeTransitionsIssue, type ClipTransition } from "./edge-transitions";
import { splitClip, updateClip } from "./timeline";
import { addTransition } from "./transitions";
import { documentIssue } from "./validate";

const wipe: ClipTransition = { kind: "wipe", durationMs: 500, easing: "linear", angle: 0 };

function title(extra: Partial<Clip> = {}): Clip {
  return { ...newOverlayClip(newTextLayer("Oferta"), 0, 2000), id: "t", ...extra };
}

function film(clip: Clip = title()): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v", kind: "visual", clips: [clip] }];
  d.durationMs = 4000;
  return d;
}

describe("entrance and exit transitions", () => {
  it("accept every visual transition kind except the plain dissolve, which is the fade", () => {
    expect(EDGE_TRANSITION_KINDS).not.toContain("dissolve");
    expect(EDGE_TRANSITION_KINDS).toEqual(expect.arrayContaining(["wipe", "iris", "gradientWipe", "venetianBlinds", "blockDissolve", "radialWipe", "push", "zoom"]));
    expect(edgeTransition({ kind: "dissolve" as never })).toBe("kind");
  });

  it("fill the kind defaults without the slide side, which the edge decides", () => {
    expect(edgeTransition({ kind: "slide" })).toEqual({ kind: "slide", durationMs: 500, easing: "easeInOut", direction: "left" });
    expect(edgeTransition({ kind: "slide", moving: "out" })).toBe("option");
    expect(edgeTransition({ kind: "radialWipe", softness: 0.3, durationMs: 700 })).toEqual({ kind: "radialWipe", durationMs: 700, easing: "linear", angle: 0, originX: 0.5, originY: 0.5, softness: 0.3 });
    expect(edgeTransition({ kind: "wipe", durationMs: 50 })).toBe("duration");
    expect(edgeTransition({ kind: "wipe", easing: "hold" })).toBe("easing");
  });

  it("keep the options of the same kind and drop them when the kind changes", () => {
    const kept = edgeTransition({ kind: "wipe", durationMs: 900 }, { ...wipe, angle: 90, durationMs: 400 });
    expect(kept).toMatchObject({ angle: 90, durationMs: 900 });
    expect(edgeTransition({ kind: "iris" }, { ...wipe, angle: 90, durationMs: 400 })).toEqual({ kind: "iris", durationMs: 400, easing: "linear", shape: "circle", originX: 0.5, originY: 0.5, reverse: false });
  });

  it("replace the fade and the slide preset of their side and stay out of the other side", () => {
    const clip = title({ fadeInMs: 300, motionIn: { edge: "bottom", durationMs: 300 }, fadeOutMs: 200 });
    const patch = edgeChoicePatch(clip, "in", "iris", 600);
    expect(patch).toMatchObject({ fadeInMs: 0, motionIn: undefined, transitionIn: { kind: "iris", durationMs: 600 } });
    expect(patch).not.toHaveProperty("fadeOutMs");
    const back = edgeChoicePatch({ ...clip, ...(patch as object) }, "in", "fade", 400);
    expect(back).toMatchObject({ fadeInMs: 400, motionIn: undefined, transitionIn: undefined });
    expect(edgeChoicePatch(clip, "out", "none", 400)).toMatchObject({ fadeOutMs: 0, motionOut: undefined, transitionOut: undefined });
  });

  it("names the current choice of a side", () => {
    expect(edgeChoiceOf(title({ transitionIn: wipe }), "in")).toBe("wipe");
    expect(edgeChoiceOf(title({ fadeOutMs: 300 }), "out")).toBe("fade");
    expect(edgeChoiceOf(title(), "out")).toBe("none");
  });

  it("validate the side rules both languages share", () => {
    expect(edgeTransitionsIssue(title({ transitionIn: wipe, transitionOut: { ...wipe, kind: "radialWipe", softness: 0.2 } }))).toBeNull();
    expect(edgeTransitionsIssue(title({ transitionIn: wipe, fadeInMs: 200 }))).toBe("covered");
    expect(edgeTransitionsIssue(title({ transitionOut: wipe, motionOut: { edge: "top", durationMs: 300 } }))).toBe("covered");
    expect(edgeTransitionsIssue(title({ transitionIn: { ...wipe, durationMs: 1500 }, fadeOutMs: 600 }))).toBe("duration");
    expect(edgeTransitionsIssue(title({ transitionIn: { ...wipe, moving: "in" } }))).toBe("option");
    expect(edgeTransitionsIssue(title({ transitionIn: { ...wipe, kind: "dissolve" as never } }))).toBe("kind");
    expect(documentIssue("video", film(title({ transitionIn: wipe, transitionOut: { kind: "gradientWipe", durationMs: 600, easing: "linear", mapAssetId: "m-1", softness: 0.4 } })))).toBeNull();
    expect(documentIssue("video", film(title({ transitionIn: wipe, fadeInMs: 100 })))?.code).toBe("invalid");
  });

  it("refuse sounds and effect clips", () => {
    const d = emptyVideoDocument("story");
    d.tracks = [{ id: "a", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 2000), id: "s", transitionIn: wipe }] }];
    d.durationMs = 2000;
    expect(documentIssue("video", d)?.code).toBe("invalid");
  });

  it("refuse an edge that already joins its neighbour through a cut transition", () => {
    const d = emptyVideoDocument("story");
    d.tracks = [{ id: "v", kind: "visual", clips: [{ ...newMediaClip("image", "m-1", 0, 2000), id: "a" }, { ...newMediaClip("image", "m-2", 2000, 2000), id: "b" }] }];
    d.durationMs = 4000;
    const joined = addTransition(d, { fromClipId: "a", toClipId: "b", kind: "dissolve" });
    if (!joined.ok) throw new Error(joined.reason);
    expect(coveringTransition(joined.document.tracks[0], "b", "in")?.id).toBe(joined.transitionId);
    expect(coveringTransition(joined.document.tracks[0], "b", "out")).toBeUndefined();
    expect(documentIssue("video", updateClip(joined.document, "b", { transitionIn: wipe }))?.code).toBe("invalid");
  });

  it("place the window at the start and at the end of the clip", () => {
    const clip = title({ transitionIn: wipe, transitionOut: { ...wipe, durationMs: 400 } });
    expect(edgePartAt(clip, 250)).toMatchObject({ side: "in", t: 0.5 });
    expect(edgePartAt(clip, 1000)).toBeNull();
    expect(edgePartAt(clip, 1800)).toMatchObject({ side: "out", t: 0.5 });
  });

  it("shorten to fit when the clip shrinks and split them between the two pieces", () => {
    const d = film(title({ transitionIn: { ...wipe, durationMs: 1200 }, transitionOut: { ...wipe, durationMs: 800 } }));
    const shrunk = updateClip(d, "t", { transitionIn: { ...wipe, durationMs: 1800 } }).tracks[0].clips[0];
    expect(shrunk.transitionIn!.durationMs + shrunk.transitionOut!.durationMs).toBeLessThanOrEqual(shrunk.durationMs);
    const split = splitClip(d, "t", 1000);
    const [left, right] = split.document.tracks[0].clips;
    expect(left.transitionIn).toBeDefined();
    expect(left.transitionOut).toBeUndefined();
    expect(right.transitionIn).toBeUndefined();
    expect(right.transitionOut).toBeDefined();
    expect(documentIssue("video", split.document)).toBeNull();
  });
});
