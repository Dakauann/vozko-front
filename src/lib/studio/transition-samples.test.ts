import { describe, expect, it } from "vitest";

import { canvasAspect } from "./document";
import { EDGE_TRANSITION_KINDS } from "./edge-transitions";
import { visualPlan } from "./playback";
import { documentIssue } from "./validate";
import { TRANSITION_KINDS } from "./transitions";
import { EFFECT_SAMPLE_SIZE } from "./vfx-samples";
import { edgeSample, transitionSample } from "./transition-samples";

describe("transition samples for the gallery previews", () => {
  it("builds a valid film caught inside the window of every cut kind", () => {
    for (const kind of TRANSITION_KINDS) {
      const { doc, atMs } = transitionSample(kind);
      expect(documentIssue("video", doc), kind).toBeNull();
      expect(doc.tracks[0].transitions?.[0].kind).toBe(kind);
      expect(visualPlan(doc, atMs).filter((item) => item.trackIndex === 0).map((item) => item.clipId)).toEqual(expect.arrayContaining(["sample-from", "sample-to"]));
    }
  });

  it("builds a valid film with a clip halfway through its entrance for every edge kind", () => {
    for (const kind of EDGE_TRANSITION_KINDS) {
      const { doc, atMs } = edgeSample(kind);
      expect(documentIssue("video", doc), kind).toBeNull();
      const clip = doc.tracks.at(-1)!.clips[0];
      expect(clip.transitionIn?.kind).toBe(kind);
      expect(atMs - clip.startMs).toBeLessThan(clip.transitionIn!.durationMs);
    }
  });

  it("is the same film every time and matches the thumbnail box", () => {
    expect(transitionSample("wipe")).toEqual(transitionSample("wipe"));
    expect(edgeSample("iris")).toEqual(edgeSample("iris"));
    expect(canvasAspect(transitionSample("wipe").doc)).toBeCloseTo(EFFECT_SAMPLE_SIZE.width / EFFECT_SAMPLE_SIZE.height, 6);
  });
});
