import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type Clip, type Transform, type VideoDocument } from "./document";
import { alignClips, distributeClips, frameSnapTargets, SAFE_AREA, snapFrameMove } from "./frame-layout";
import { findClip } from "./timeline";

function box(x: number, y: number, w: number, h: number): Transform {
  return { x, y, w, h, rotation: 0, opacity: 1 };
}

function image(id: string, transform: Transform, extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("image", `m-${id}`, 0, 4000), id, transform, ...extra };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [image("a", box(0.2, 0.2, 0.1, 0.1))] },
    { id: "v2", kind: "visual", clips: [image("b", box(0.5, 0.6, 0.2, 0.2))] },
    { id: "v3", kind: "visual", clips: [image("c", box(0.9, 0.3, 0.1, 0.2))] },
    { id: "sound", kind: "audio", clips: [{ ...newMediaClip("audio", "m-s", 0, 4000), id: "s" }] },
  ];
  d.durationMs = 4000;
  return d;
}

function placed(d: VideoDocument, id: string): Transform {
  return findClip(d, id)!.clip.transform;
}

function ok(result: ReturnType<typeof alignClips>): VideoDocument {
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result.document;
}

describe("alignClips", () => {
  it("aligns one clip to the frame", () => {
    const next = ok(alignClips(doc(), ["a"], "right", { playheadMs: 1000 }));
    expect(placed(next, "a").x).toBeCloseTo(0.95);
    expect(placed(next, "a").y).toBeCloseTo(0.2);
  });

  it("aligns several clips to their own bounds, or to the frame when asked", () => {
    const together = ok(alignClips(doc(), ["a", "b", "c"], "left", { playheadMs: 1000 }));
    expect(placed(together, "a").x).toBeCloseTo(0.2);
    expect(placed(together, "b").x).toBeCloseTo(0.25);
    expect(placed(together, "c").x).toBeCloseTo(0.2);
    const framed = ok(alignClips(doc(), ["a", "b"], "middle", { playheadMs: 1000, relativeTo: "frame" }));
    expect(placed(framed, "a").y).toBeCloseTo(0.5);
    expect(placed(framed, "b").y).toBeCloseTo(0.5);
  });

  it("skips sound clips in the selection and reports what moved", () => {
    const result = alignClips(doc(), ["a", "s"], "top", { playheadMs: 0 });
    expect(result.ok && result.changed).toEqual(["a"]);
    expect(result.ok && result.skipped).toEqual(["s"]);
  });

  it("writes a key at the playhead on a clip animated in position", () => {
    const d = doc();
    d.tracks[0].clips[0] = image("a", box(0.2, 0.2, 0.1, 0.1), {
      keyframes: {
        x: [
          { atMs: 0, value: 0.2, easing: "linear" },
          { atMs: 2000, value: 0.4, easing: "linear" },
        ],
      },
    });
    const result = alignClips(d, ["a"], "left", { playheadMs: 1000 });
    const next = ok(result);
    const keys = findClip(next, "a")!.clip.keyframes!.x!;
    expect(keys.map((key) => key.atMs)).toEqual([0, 1000, 2000]);
    expect(keys[1].value).toBeCloseTo(0.05);
    expect(result.ok && result.keyed).toEqual(["a"]);
  });

  it("refuses a keyed clip outside the playhead, a locked track, missing clips and sound only", () => {
    const d = doc();
    d.tracks[0].clips[0] = image("a", box(0.2, 0.2, 0.1, 0.1), {
      startMs: 2000,
      durationMs: 2000,
      keyframes: {
        y: [
          { atMs: 0, value: 0.2, easing: "linear" },
          { atMs: 1000, value: 0.4, easing: "linear" },
        ],
      },
    });
    expect(alignClips(d, ["a"], "top", { playheadMs: 500 })).toEqual({ ok: false, reason: "keyframeOutside", clipId: "a" });
    const locked = doc();
    locked.tracks[1].locked = true;
    expect(alignClips(locked, ["a", "b"], "top", { playheadMs: 0 })).toEqual({ ok: false, reason: "locked", clipId: "b" });
    expect(alignClips(doc(), ["zz"], "top", { playheadMs: 0 })).toEqual({ ok: false, reason: "missing", clipId: "zz" });
    expect(alignClips(doc(), ["s"], "top", { playheadMs: 0 })).toEqual({ ok: false, reason: "notVisual", clipId: "s" });
  });

  it("refuses a move that would push a center past the frame range", () => {
    const d = doc();
    d.tracks[0].clips[0] = image("a", box(0.5, 0.5, 3, 0.1));
    expect(alignClips(d, ["a"], "left", { playheadMs: 0 })).toEqual({ ok: false, reason: "outOfRange", clipId: "a" });
  });
});

describe("distributeClips", () => {
  it("spaces three or more clips evenly", () => {
    const next = ok(distributeClips(doc(), ["a", "b", "c"], "horizontal", { playheadMs: 0 }));
    expect(placed(next, "a").x).toBeCloseTo(0.2);
    expect(placed(next, "b").x).toBeCloseTo(0.55);
    expect(placed(next, "c").x).toBeCloseTo(0.9);
  });

  it("needs three visual clips", () => {
    expect(distributeClips(doc(), ["a", "b", "s"], "vertical", { playheadMs: 0 })).toEqual({ ok: false, reason: "tooFew" });
  });
});

describe("frameSnapTargets", () => {
  it("collects the frame, the safe area when shown and the other clips on screen", () => {
    const { targets, others } = frameSnapTargets(doc(), 1000, ["a"], true);
    expect(targets.x.slice(0, 3)).toEqual([0, 540, 1080]);
    expect(targets.x).toContain(SAFE_AREA.left * 1080);
    expect(targets.y).toContain(SAFE_AREA.bottom * 1080);
    expect(others).toHaveLength(2);
    expect(others[0]).toEqual({ left: 432, top: 540, right: 648, bottom: 756 });
    expect(frameSnapTargets(doc(), 1000, ["a"], false).targets.x).not.toContain(SAFE_AREA.left * 1080);
  });
});

describe("snapFrameMove", () => {
  const size = { width: 1000, height: 1000 };
  const scene = { targets: { x: [0, 500, 1000], y: [0, 500, 1000] }, others: [{ left: 700, top: 450, right: 800, bottom: 550 }] };

  it("pulls the moved boxes onto a line and measures the gaps around them", () => {
    const snap = snapFrameMove([box(0.3, 0.5, 0.1, 0.1)], 0.197, 0.002, size, scene, 5);
    expect(snap.dx).toBeCloseTo(0.2);
    expect(snap.dy).toBeCloseTo(0);
    expect(snap.guides.vertical).toEqual([500]);
    expect(snap.guides.horizontal).toEqual([500]);
    expect(snap.gaps).toContainEqual({ axis: "horizontal", from: 550, to: 700, at: 500 });
  });

  it("moves freely without a threshold and snaps a group by its outer bounds", () => {
    const free = snapFrameMove([box(0.3, 0.5, 0.1, 0.1)], 0.197, 0, size, scene, null);
    expect(free.dx).toBeCloseTo(0.197);
    expect(free.guides).toEqual({ vertical: [], horizontal: [] });
    const group = snapFrameMove([box(0.1, 0.2, 0.1, 0.1), box(0.3, 0.2, 0.1, 0.1)], -0.048, 0, size, scene, 5);
    expect(group.dx).toBeCloseTo(-0.05);
    expect(group.guides.vertical).toEqual([0]);
  });
});
