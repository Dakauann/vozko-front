import { describe, expect, it } from "vitest";

import { canvasAspect } from "./document";
import { visualPlan } from "./playback";
import { documentIssue } from "./validate";
import { actsOnPlan, glitchBurst, listensToTrack, refusedOnEffectClips, VFX_KINDS, vfxLook } from "./vfx";
import { EFFECT_SAMPLE_SIZE, effectSample, plainSample, SAMPLE_SOUND_TRACK } from "./vfx-samples";

describe("effect samples for the panel thumbnails", () => {
  it("builds a valid film with the effect on top of a colorful backdrop for every kind", () => {
    for (const kind of VFX_KINDS) {
      const { doc, atMs, levels } = effectSample(kind);
      expect(documentIssue("video", doc)).toBeNull();
      const plan = visualPlan(doc, atMs, undefined, levels);
      const holder = refusedOnEffectClips(kind) ? plan.find((item) => item.vfx?.length || item.echo) : plan.at(-1);
      if (!refusedOnEffectClips(kind)) {
        expect(holder?.type).toBe("effect");
        expect(holder?.vfx?.map((look) => look.kind) ?? []).toEqual(actsOnPlan(kind) ? [] : [kind]);
      }
      expect(plan.filter((item) => item.type === "overlay").length).toBeGreaterThanOrEqual(3);
    }
  });

  it("puts the echo on the moving shape, since an effect clip cannot repeat itself", () => {
    const { doc, atMs } = effectSample("echo");
    const sun = visualPlan(doc, atMs).find((item) => item.clipId.endsWith("sun"));
    expect(sun?.echo?.length).toBe(4);
    expect(sun?.echo?.map((copy) => copy.transform.x)).toEqual([...(sun?.echo?.map((copy) => copy.transform.x) ?? [])].sort((a, b) => a - b));
  });

  it("feeds the sound kinds a steady sample of levels, so their bars are not flat", () => {
    for (const kind of VFX_KINDS.filter(listensToTrack)) {
      const { doc, atMs, levels } = effectSample(kind);
      expect(levels(SAMPLE_SOUND_TRACK)).toBeDefined();
      const bars = visualPlan(doc, atMs, undefined, levels).at(-1)?.vfx?.[0].bars ?? [];
      expect(bars.length).toBeGreaterThan(0);
      expect(Math.max(...bars) - Math.min(...bars)).toBeGreaterThan(0.1);
    }
  });

  it("is the same film every time, so a cached thumbnail never goes stale", () => {
    expect(effectSample("particles")).toEqual(effectSample("particles"));
  });

  it("shows a moment where the effect is visible", () => {
    const { doc, atMs } = effectSample("glitch");
    const fx = doc.tracks.flatMap((track) => track.clips).find((clip) => clip.type === "effect")!;
    expect(glitchBurst(vfxLook(fx.vfx![0], atMs - fx.startMs)).strength).toBeGreaterThan(0);
  });

  it("matches the thumbnail box", () => {
    const { doc } = effectSample("grain");
    expect(canvasAspect(doc)).toBeCloseTo(EFFECT_SAMPLE_SIZE.width / EFFECT_SAMPLE_SIZE.height, 6);
  });
});

describe("the plain sample beside each effect", () => {
  it("is the same backdrop with no effect on top", () => {
    const { doc, atMs } = plainSample();
    expect(documentIssue("video", doc)).toBeNull();
    expect(atMs).toBe(effectSample("grain").atMs);
    const effect = effectSample("vignette").doc;
    expect(doc.tracks).toEqual(effect.tracks.filter((track) => !track.clips.some((clip) => clip.type === "effect")));
    expect(visualPlan(doc, atMs).some((item) => item.type === "effect")).toBe(false);
  });
});
