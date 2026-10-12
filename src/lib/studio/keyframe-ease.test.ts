import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip } from "./document";
import {
  allSmooth,
  EASE_INFLUENCE,
  easeKeySides,
  keySideShapes,
  keyVelocity,
  reversedEasing,
  reversedSnippet,
  reverseKeys,
  roveKeys,
  segmentBezier,
  setKeysVelocity,
  setSmooth,
  settleSmooth,
  stretchKeys,
} from "./keyframe-ease";
import { keyframesIssue, setKeyEasingAt, valueAt, type Keyframe, type Keyframes } from "./keyframes";
import { findClip, insertClip, updateClip } from "./timeline";

const box = { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 };

function key(atMs: number, value: number, easing: Keyframe["easing"] = "linear", smooth?: boolean): Keyframe {
  return smooth ? { atMs, value, easing, smooth } : { atMs, value, easing };
}

function lane(...frames: Keyframe[]): Keyframes {
  return { x: frames };
}

function speedAround(frames: readonly Keyframe[], atMs: number, side: "in" | "out"): number {
  const step = 0.01;
  return side === "in" ? (valueAt(frames, atMs) - valueAt(frames, atMs - step)) / step : (valueAt(frames, atMs + step) - valueAt(frames, atMs)) / step;
}

describe("segment sides", () => {
  it("reads named curves as their bezier and a hold as no curve", () => {
    expect(segmentBezier("linear")).toEqual([0.333, 0.333, 0.667, 0.667]);
    expect(segmentBezier("easeIn")).toEqual([0.333, 0, 0.667, 0]);
    expect(segmentBezier("easeOut")).toEqual([0.333, 1, 0.667, 1]);
    expect(segmentBezier("cubic-bezier(0.2,0,0,1)")).toEqual([0.2, 0, 0, 1]);
    expect(segmentBezier("hold")).toBeNull();
  });

  it("reverses curves in time, keeping names where one exists", () => {
    expect(reversedEasing("easeIn")).toBe("easeOut");
    expect(reversedEasing("backOut")).toBe("backIn");
    expect(reversedEasing("easeInOut")).toBe("easeInOut");
    expect(reversedEasing("hold")).toBe("hold");
    expect(reversedEasing("cubic-bezier(0.05,0.7,0.1,1)")).toBe("cubic-bezier(0.9,0,0.95,0.3)");
  });
});

describe("easing both sides, the incoming or the outgoing side of keys", () => {
  const three = lane(key(0, 0), key(1000, 0.5), key(2000, 1));

  it("eases both sides of a middle key with speed zero and a third of influence", () => {
    const eased = easeKeySides(three, [{ property: "x", atMs: 1000 }], "both").keyframes!;
    expect(eased.x!.map((f) => f.easing)).toEqual(["cubic-bezier(0.333,0.333,0.667,1)", "cubic-bezier(0.333,0,0.667,0.667)", "linear"]);
    expect(Math.abs(speedAround(eased.x!, 1000, "in"))).toBeLessThan(1e-4);
    expect(Math.abs(speedAround(eased.x!, 1000, "out"))).toBeLessThan(1e-4);
  });

  it("writes the standard ease when both keys of a segment ease both sides", () => {
    const pair = lane(key(0, 0), key(1000, 1));
    const eased = easeKeySides(pair, [{ property: "x", atMs: 0 }, { property: "x", atMs: 1000 }], "both").keyframes!;
    expect(eased.x![0].easing).toBe("cubic-bezier(0.333,0,0.667,1)");
  });

  it("eases only the arrival with the incoming side, even on the last key", () => {
    const eased = easeKeySides(three, [{ property: "x", atMs: 2000 }], "in");
    expect(eased.applied).toBe(1);
    expect(eased.keyframes!.x!.map((f) => f.easing)).toEqual(["linear", "cubic-bezier(0.333,0.333,0.667,1)", "linear"]);
  });

  it("changes nothing for sides a key does not have", () => {
    expect(easeKeySides(three, [{ property: "x", atMs: 0 }], "in")).toEqual({ keyframes: three, applied: 0 });
    expect(easeKeySides(three, [{ property: "x", atMs: 2000 }], "out")).toEqual({ keyframes: three, applied: 0 });
  });

  it("turns a held key into a curve when its outgoing side is eased and leaves a held arrival alone", () => {
    const held = lane(key(0, 0, "hold"), key(1000, 1));
    expect(easeKeySides(held, [{ property: "x", atMs: 0 }], "out").keyframes!.x![0].easing).toBe("cubic-bezier(0.333,0,0.667,0.667)");
    expect(easeKeySides(held, [{ property: "x", atMs: 1000 }], "in").applied).toBe(0);
  });

  it("eases color and path keys too", () => {
    const k: Keyframes = {
      fill: [{ atMs: 0, color: "#000000", easing: "linear" }, { atMs: 1000, color: "#ffffff", easing: "linear" }],
      position: [{ atMs: 0, x: 0.2, y: 0.2, easing: "linear" }, { atMs: 1000, x: 0.8, y: 0.2, easing: "linear" }],
    };
    const eased = easeKeySides(k, [{ property: "fill", atMs: 0 }, { property: "position", atMs: 1000 }], "both").keyframes!;
    expect(eased.fill![0].easing).toBe("cubic-bezier(0.333,0,0.667,0.667)");
    expect(eased.position![0].easing).toBe("cubic-bezier(0.333,0.333,0.667,1)");
  });

  it("makes an eased smooth key a manual one", () => {
    const smooth = lane(key(0, 0), key(1000, 0.5, "linear", true), key(2000, 1));
    expect(easeKeySides(smooth, [{ property: "x", atMs: 1000 }], "both").keyframes!.x![1].smooth).toBeUndefined();
  });
});

describe("key velocity", () => {
  it("reads speed in property units per second and influence per side", () => {
    const eased = easeKeySides(lane(key(0, 0), key(1000, 0.5), key(2000, 1)), [{ property: "x", atMs: 1000 }], "in").keyframes;
    const velocity = keyVelocity(eased, "x", 1000)!;
    expect(velocity.in).toEqual({ speed: 0, influence: EASE_INFLUENCE });
    expect(velocity.out?.speed).toBeCloseTo(0.5);
    expect(velocity.out?.influence).toBeCloseTo(0.333);
    expect(keyVelocity(eased, "x", 0)!.in).toBeNull();
  });

  it("sets speed and influence on a side and keeps the value curve through the keys", () => {
    const k = lane(key(0, 0), key(1000, 1));
    const result = setKeysVelocity(k, [{ property: "x", atMs: 0 }], { out: { speed: 2, influence: 0.5 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.keyframes!.x![0].easing).toBe("cubic-bezier(0.5,1,0.667,0.667)");
    expect(keyVelocity(result.keyframes, "x", 0)!.out).toEqual({ speed: 2, influence: 0.5 });
    expect(speedAround(result.keyframes!.x!, 0, "out") * 1000).toBeCloseTo(2, 1);
  });

  it("refuses a speed the curve cannot reach and names the range", () => {
    const result = setKeysVelocity(lane(key(0, 0), key(1000, 1)), [{ property: "x", atMs: 0 }], { out: { speed: 10, influence: 0.5 } });
    expect(result).toEqual({ ok: false, refusal: { kind: "steep", property: "x", atMs: 0, side: "out", range: [-2, 4] } });
  });

  it("refuses a speed on a segment that does not change and on colors, but allows stopping", () => {
    const flat = lane(key(0, 0.5), key(1000, 0.5));
    expect(setKeysVelocity(flat, [{ property: "x", atMs: 0 }], { out: { speed: 1 } })).toEqual({ ok: false, refusal: { kind: "flat", property: "x", atMs: 0, side: "out" } });
    expect(setKeysVelocity(flat, [{ property: "x", atMs: 0 }], { out: { speed: 0 } }).ok).toBe(true);
    const color: Keyframes = { fill: [{ atMs: 0, color: "#000000", easing: "linear" }, { atMs: 1000, color: "#ffffff", easing: "linear" }] };
    expect(setKeysVelocity(color, [{ property: "fill", atMs: 0 }], { out: { speed: 3 } })).toEqual({ ok: false, refusal: { kind: "notNumeric", property: "fill" } });
    expect(setKeysVelocity(color, [{ property: "fill", atMs: 0 }], { out: { speed: 0, influence: 0.6 } }).ok).toBe(true);
  });

  it("changes influence alone without changing speed", () => {
    const result = setKeysVelocity(lane(key(0, 0), key(1000, 1)), [{ property: "x", atMs: 1000 }], { in: { influence: 0.8 } });
    expect(result.ok && keyVelocity(result.keyframes, "x", 1000)!.in).toEqual({ speed: 1, influence: 0.8 });
  });

  it("refuses an influence outside 0.1 to 100 percent and keys with nothing to change", () => {
    expect(setKeysVelocity(lane(key(0, 0), key(1000, 1)), [{ property: "x", atMs: 0 }], { out: { influence: 0 } })).toEqual({ ok: false, refusal: { kind: "influence" } });
    expect(setKeysVelocity(lane(key(0, 0), key(1000, 1)), [{ property: "x", atMs: 0 }], { in: { speed: 0 } })).toEqual({ ok: false, refusal: { kind: "noSide" } });
  });
});

describe("smooth keys", () => {
  it("keeps the speed continuous through a smooth key", () => {
    const settled = settleSmooth(lane(key(0, 0), key(1000, 0.2, "linear", true), key(2000, 1)))!;
    const frames = settled.x!;
    expect(speedAround(frames, 1000, "in")).toBeCloseTo(speedAround(frames, 1000, "out"), 3);
    expect(speedAround(frames, 1000, "in")).toBeCloseTo(0.0005, 4);
    expect(keyframesIssue(settled, box)).toBeNull();
  });

  it("stops at a peak so the curve never overshoots the key", () => {
    const frames = settleSmooth(lane(key(0, 0), key(1000, 1, "linear", true), key(2000, 0)))!.x!;
    expect(keyVelocity({ x: frames }, "x", 1000)).toMatchObject({ in: { speed: 0 }, out: { speed: 0 }, smooth: true });
    for (let at = 0; at <= 2000; at += 50) expect(valueAt(frames, at)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("settles once and returns the same lanes when nothing is smooth", () => {
    const plain = lane(key(0, 0), key(1000, 1));
    expect(settleSmooth(plain)).toBe(plain);
    const once = settleSmooth(lane(key(0, 0), key(1000, 0.2, "linear", true), key(2000, 1)));
    expect(settleSmooth(once)).toBe(once);
  });

  it("marks and unmarks keys, and an explicit curve makes the keys of that segment manual", () => {
    const marked = setSmooth(lane(key(0, 0), key(1000, 0.2), key(2000, 1)), [{ property: "x", atMs: 1000 }], true);
    expect(marked!.x![1].smooth).toBe(true);
    expect(setSmooth(marked, [{ property: "x", atMs: 1000 }], false)!.x![1].smooth).toBeUndefined();
    const curved = setKeyEasingAt(lane(key(0, 0, "linear", true), key(1000, 1, "linear", true), key(2000, 0, "linear", true)), "x", 0, "easeIn")!;
    expect(curved.x!.map((f) => f.smooth)).toEqual([undefined, undefined, true]);
  });

  it("is settled by every clip edit", () => {
    const empty = emptyVideoDocument("story");
    const placed = insertClip(empty, empty.tracks[0].id, { ...newMediaClip("image", "img", 0, 3000), id: "c" });
    const next = updateClip(placed.document, "c", { keyframes: lane(key(0, 0), key(1000, 0.2, "linear", true), key(2000, 1)) });
    const frames = findClip(next, "c")!.clip.keyframes!.x!;
    expect(speedAround(frames, 1000, "in")).toBeCloseTo(speedAround(frames, 1000, "out"), 3);
  });
});

describe("time reverse", () => {
  it("plays the selected keys backwards in place", () => {
    const k = lane(key(0, 0.1, "easeIn"), key(400, 0.3, "cubic-bezier(0.2,0,0,1)"), key(1000, 0.9));
    const edit = reverseKeys(k, [0, 400, 1000].map((atMs) => ({ property: "x" as const, atMs })))!;
    const reversed = edit.keyframes;
    expect(reversed.x!.map((f) => f.atMs)).toEqual([0, 600, 1000]);
    expect(edit.keys).toEqual([1000, 600, 0].map((atMs) => ({ property: "x", atMs })));
    for (const at of [0, 120, 300, 600, 777, 1000]) expect(valueAt(reversed.x!, at)).toBeCloseTo(valueAt(k.x!, 1000 - at), 6);
  });

  it("mirrors every selected property over the same span", () => {
    const k: Keyframes = { x: [key(0, 0), key(1000, 1)], opacity: [key(200, 0), key(500, 1)] };
    const keys = [...k.x!, ...k.opacity!].map((f, i) => ({ property: i < 2 ? ("x" as const) : ("opacity" as const), atMs: f.atMs }));
    expect(reverseKeys(k, keys)!.keyframes.opacity!.map((f) => [f.atMs, f.value])).toEqual([
      [500, 1],
      [800, 0],
    ]);
  });

  it("refuses when a reversed key would land on a key that stays", () => {
    const k = lane(key(0, 0), key(300, 0.5), key(700, 1), key(1000, 0));
    expect(reverseKeys(k, [{ property: "x", atMs: 0 }, { property: "x", atMs: 300 }, { property: "x", atMs: 1000 }])).toBeNull();
  });

  it("reverses a copied animation over its own length", () => {
    const snippet: Keyframes = { x: [key(0, 0, "easeOut"), key(800, 1)], opacity: [key(0, 0), key(400, 1)] };
    const reversed = reversedSnippet(snippet);
    expect(reversed.x!.map((f) => [f.atMs, f.value, f.easing])).toEqual([
      [0, 1, "easeIn"],
      [800, 0, "linear"],
    ]);
    expect(reversed.opacity!.map((f) => [f.atMs, f.value])).toEqual([
      [400, 1],
      [800, 0],
    ]);
  });
});

describe("stretching keys in time", () => {
  const k = lane(key(0, 0), key(1000, 0.5), key(2000, 1), key(5000, 0));
  const picked = [0, 1000, 2000].map((atMs) => ({ property: "x" as const, atMs }));

  it("stretches the selection from its first or its last key", () => {
    const longer = stretchKeys(k, picked, 1.5, "first")!;
    expect(longer.keyframes.x!.map((f) => f.atMs)).toEqual([0, 1500, 3000, 5000]);
    expect(longer.keys.map((ref) => ref.atMs)).toEqual([0, 1500, 3000]);
    expect(stretchKeys(k, picked, 0.5, "last")!.keyframes.x!.map((f) => f.atMs)).toEqual([1000, 1500, 2000, 5000]);
  });

  it("refuses a stretch that lands on a key that stays or squeezes keys together", () => {
    expect(stretchKeys(k, picked, 2.5, "first")).toBeNull();
    expect(stretchKeys(k, picked, 0.0001, "first")).toBeNull();
    expect(stretchKeys(k, picked, 0, "first")).toBeNull();
  });
});

describe("roving keys", () => {
  it("moves the middle keys in time so the speed stays constant", () => {
    const k = lane(key(0, 0, "easeOut"), key(200, 0.6), key(2000, 1));
    const edit = roveKeys(k, [0, 200, 2000].map((atMs) => ({ property: "x" as const, atMs })), 1)!;
    const roved = edit.keyframes;
    expect(roved.x!.map((f) => f.atMs)).toEqual([0, 1200, 2000]);
    expect(edit.keys.map((ref) => ref.atMs)).toEqual([0, 1200, 2000]);
    expect(roved.x![0].easing).toBe("cubic-bezier(0.333,1,0.667,0.667)");
    expect(roved.x![1].easing).toBe("linear");
  });

  it("measures a path by its length", () => {
    const k: Keyframes = {
      position: [
        { atMs: 0, x: 0, y: 0.5, easing: "linear", spatial: "linear" },
        { atMs: 100, x: 0.25, y: 0.5, easing: "linear", spatial: "linear" },
        { atMs: 1000, x: 1, y: 0.5, easing: "linear", spatial: "linear" },
      ],
    };
    const roved = roveKeys(k, [0, 100, 1000].map((atMs) => ({ property: "position" as const, atMs })), 1)!.keyframes;
    expect(roved.position!.map((f) => f.atMs)).toEqual([0, 250, 1000]);
  });

  it("leaves lanes that do not move and needs three keys", () => {
    const still = lane(key(0, 0.5), key(500, 0.5), key(1000, 0.5));
    expect(roveKeys(still, [0, 500, 1000].map((atMs) => ({ property: "x" as const, atMs })), 1)!.keyframes).toBe(still);
    const two = lane(key(0, 0), key(1000, 1));
    expect(roveKeys(two, [0, 1000].map((atMs) => ({ property: "x" as const, atMs })), 1)!.keyframes).toBe(two);
  });
});

describe("smooth state of a selection", () => {
  it("is on only when every chosen key is smooth", () => {
    const k = lane(key(0, 0, "linear", true), key(1000, 1, "linear", true), key(2000, 0));
    expect(allSmooth(k, [{ property: "x", atMs: 0 }, { property: "x", atMs: 1000 }])).toBe(true);
    expect(allSmooth(k, [{ property: "x", atMs: 0 }, { property: "x", atMs: 2000 }])).toBe(false);
    expect(allSmooth(k, [])).toBe(false);
  });
});

describe("key side shapes", () => {
  it("names each side linear, eased, held or smooth", () => {
    const k = easeKeySides(lane(key(0, 0, "hold"), key(1000, 0.5), key(2000, 1), key(3000, 0.5, "linear", true), key(4000, 1)), [{ property: "x", atMs: 2000 }], "in").keyframes;
    expect(keySideShapes(k, "x", 0)).toEqual({ in: "none", out: "hold" });
    expect(keySideShapes(k, "x", 1000)).toEqual({ in: "hold", out: "linear" });
    expect(keySideShapes(k, "x", 2000)).toEqual({ in: "eased", out: "linear" });
    expect(keySideShapes(k, "x", 3000)).toEqual({ in: "smooth", out: "smooth" });
  });
});
