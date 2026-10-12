import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { placementAt } from "./clip-placement";
import { canvasAspect, emptyVideoDocument, newMediaClip, newNullClip, type Clip, type Transform, type VideoDocument } from "./document";
import { insertNull, parentChoices, setClipParent } from "./parent-edit";
import { boxToLocal, boxToWorld, childIds, clipLookup, descendantIds, frameAt, pointToLocal, pointToWorld, worldPlacementAt, type ParentFrame } from "./parenting";
import { visualPlan } from "./playback";
import { deleteClips, duplicateClips, splitClip } from "./timeline";
import { clearRange, duplicateGroup } from "./edits";
import { copyClips, pasteClips } from "./tools";
import { documentIssue } from "./validate";

const ASPECT = 9 / 16;

function film(clips: Clip[][]): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.tracks = clips.map((list, index) => ({ id: `t${index}`, kind: "visual" as const, clips: list }));
  doc.durationMs = 4000;
  return doc;
}

function image(id: string, transform: Partial<Transform> = {}, extra: Partial<Clip> = {}): Clip {
  const base = newMediaClip("image", `m-${id}`, 0, 4000);
  return { ...base, id, transform: { ...base.transform, w: 0.2, h: 0.1, ...transform }, ...extra };
}

function nul(id: string, extra: Partial<Clip> = {}, transform: Partial<Transform> = {}): Clip {
  const base = newNullClip(0, 4000);
  return { ...base, id, ...extra, transform: { ...base.transform, ...transform } };
}

function world(doc: VideoDocument, id: string, atMs: number): Transform {
  return visualPlan(doc, atMs, 0).find((item) => item.clipId === id)!.transform;
}

function close(actual: Transform, expected: Partial<Transform>, digits = 9) {
  for (const [key, value] of Object.entries(expected)) expect(actual[key as keyof Transform], key).toBeCloseTo(value as number, digits);
}

describe("composing a parent frame", () => {
  it("maps points out and back through a turned, unevenly scaled frame", () => {
    const frame: ParentFrame = { x: 0.3, y: 0.6, rotation: 37, scaleX: 1.7, scaleY: 0.6 };
    const point = { x: 0.81, y: 0.12 };
    const back = pointToLocal(frame, pointToWorld(frame, point, ASPECT), ASPECT)!;
    expect(back.x).toBeCloseTo(point.x, 12);
    expect(back.y).toBeCloseTo(point.y, 12);
  });

  it("turns a box with the frame and keeps it a rectangle on uneven scale", () => {
    const frame: ParentFrame = { x: 0.5, y: 0.5, rotation: 30, scaleX: 2, scaleY: 0.5 };
    const box: Transform = { x: 0.6, y: 0.4, w: 0.2, h: 0.1, rotation: 20, opacity: 0.4 };
    const out = boxToWorld(frame, box, ASPECT);
    expect(out.opacity).toBe(0.4);
    close(boxToLocal(frame, out, ASPECT)!, box, 10);
    const even = boxToWorld({ ...frame, scaleY: 2 }, box, ASPECT);
    close(even, { rotation: 50, w: 0.4, h: 0.2 });
  });

  it("refuses to invert a frame scaled to nothing", () => {
    expect(pointToLocal({ x: 0.5, y: 0.5, rotation: 0, scaleX: 0, scaleY: 1 }, { x: 0.2, y: 0.2 }, ASPECT)).toBeNull();
  });
});

describe("a clip that follows its parent", () => {
  it("draws exactly as before without a parent", () => {
    const doc = film([[image("a", { x: 0.3, y: 0.7, rotation: 12 })]]);
    expect(world(doc, "a", 500)).toEqual(placementAt(doc.tracks[0].clips[0], 500, canvasAspect(doc)));
  });

  it("moves, turns and scales with a null around its anchor point", () => {
    const parent = nul("n", { keyframes: { x: [{ atMs: 0, value: 0.5, easing: "linear" }, { atMs: 1000, value: 0.7, easing: "linear" }], rotation: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 90, easing: "linear" }] } }, { w: 0.2, h: 0.2 });
    const child = image("c", { x: 0.5, y: 0.3 }, { parentId: "n" });
    const doc = film([[child], [parent]]);
    close(world(doc, "c", 0), { x: 0.5, y: 0.5 - 0.2 * 2, w: 0.4, h: 0.2, rotation: 0 });
    const end = world(doc, "c", 1000);
    const offset = 0.2 * 2;
    close(end, { x: 0.7 + offset / ASPECT, y: 0.5, rotation: 90, w: 0.4, h: 0.2 });
    expect(world(doc, "c", 3000)).toEqual(end);
  });

  it("holds the parent's edge value outside the parent's time", () => {
    const parent = { ...nul("n", { keyframes: { x: [{ atMs: 0, value: 0.4, easing: "linear" }, { atMs: 1000, value: 0.6, easing: "linear" }] } }), startMs: 1000, durationMs: 1000 };
    const child = image("c", { x: 0.5, y: 0.5 }, { parentId: "n" });
    const doc = film([[child], [parent]]);
    close(world(doc, "c", 200), { x: 0.4 });
    close(world(doc, "c", 3500), { x: 0.6 });
  });

  it("composes a chain of parents across tracks", () => {
    const top = nul("top", { keyframes: { rotation: [{ atMs: 0, value: 180, easing: "linear" }] } });
    const middle = nul("mid", { parentId: "top" }, { x: 0.6, y: 0.5 });
    const child = image("c", { x: 0.6, y: 0.5 }, { parentId: "mid" });
    const doc = film([[child], [middle], [top]]);
    close(world(doc, "c", 0), { x: 0.3, y: 0.5, rotation: 180 });
    expect(descendantIds(doc, "top").sort()).toEqual(["c", "mid"]);
    expect(childIds(doc, "top")).toEqual(["mid"]);
  });

  it("does not pass opacity or draw the null", () => {
    const parent = nul("n");
    const child = image("c", { opacity: 0.5 }, { parentId: "n" });
    const doc = film([[child], [parent]]);
    const plan = visualPlan(doc, 100, 0);
    expect(plan.find((item) => item.clipId === "c")!.opacity).toBe(0.5);
    expect(plan.find((item) => item.clipId === "n")).toMatchObject({ type: "null", opacity: 0 });
  });

  it("scales children by the null's size and by a parent's scale lanes", () => {
    const grown = nul("n", {}, { w: 0.2, h: 0.1 });
    const doc = film([[image("c", { x: 0.6, y: 0.5 }, { parentId: "n" })], [grown]]);
    close(world(doc, "c", 0), { x: 0.5 + 0.1 * 2, w: 0.4, h: 0.1 });
    const photo = image("p", { x: 0.5, y: 0.5, w: 1, h: 1 }, { keyframes: { scale: [{ atMs: 0, value: 3, easing: "linear" }] } });
    const scaled = film([[photo], [image("c", { x: 0.6, y: 0.5 }, { parentId: "p" })]]);
    close(world(scaled, "c", 0), { x: 0.8, w: 0.6 });
  });
});

describe("the parent contract", () => {
  it("accepts the shared fixture", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_parent.json"), "utf8"));
    expect(documentIssue("video", raw)).toBeNull();
  });

  it("refuses missing parents, cycles and clips that cannot follow", () => {
    const cases: Clip[][][] = [
      [[image("c", {}, { parentId: "ghost" })]],
      [[image("a", {}, { parentId: "b" })], [image("b", {}, { parentId: "a" })]],
      [[image("a", {}, { parentId: "a" })]],
      [[image("c", {}, { parentId: "n" })], [{ ...nul("n"), type: "effect" as const, transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } }]],
    ];
    for (const clips of cases) expect(documentIssue("video", film(clips))).toEqual({ field: "document.tracks", code: "invalid" });
  });

  it("lets a child sit outside the frame only while parented", () => {
    expect(documentIssue("video", film([[image("c", { x: -0.4 }, { parentId: "n" })], [nul("n")]]))).toBeNull();
    expect(documentIssue("video", film([[image("c", { x: -0.4 })]]))?.code).toBe("out_of_range");
    expect(documentIssue("video", film([[image("c", { x: 2.4 }, { parentId: "n" })], [nul("n")]]))?.code).toBe("out_of_range");
  });

  it("keeps nulls to placement only", () => {
    expect(documentIssue("video", film([[nul("n", { anchor: { x: 0, y: 0 }, autoOrient: true, keyframes: { position: [{ atMs: 0, x: 0.2, y: 0.2, easing: "linear" }], scale: [{ atMs: 0, value: 2, easing: "linear" }] } })]]))).toBeNull();
    const bad: Partial<Clip>[] = [{ keyframes: { opacity: [{ atMs: 0, value: 0.5, easing: "linear" }] } }, { fadeInMs: 100 }, { assetId: "m-1" }, { blur: 3 }, { flipX: true }];
    for (const extra of bad) expect(documentIssue("video", film([[nul("n", extra)]]))?.code, JSON.stringify(extra)).toBe("invalid");
    expect(documentIssue("video", film([[nul("n", {}, { opacity: 0.5 })]]))?.code).toBe("invalid");
  });
});

describe("linking and unlinking", () => {
  const spin = (): VideoDocument => {
    const parent = nul("n", { keyframes: { rotation: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 2000, value: 60, easing: "linear" }] } }, { x: 0.4, y: 0.6, w: 0.15, h: 0.1 });
    const child = image("c", { x: 0.7, y: 0.3, rotation: 10 }, { anchor: { x: 0, y: 1 }, keyframes: { x: [{ atMs: 0, value: 0.7, easing: "easeOut" }, { atMs: 2000, value: 0.8, easing: "linear" }], y: [{ atMs: 500, value: 0.3, easing: "linear" }, { atMs: 1500, value: 0.4, easing: "linear" }] } });
    return film([[child], [parent]]);
  };

  it("keeps the picture at the moment of linking and of unlinking", () => {
    const doc = spin();
    const before = world(doc, "c", 1000);
    const linked = setClipParent(doc, "c", "n", { keepVisual: true, atMs: 1000 });
    if (!linked.ok) throw new Error(linked.reason);
    expect(linked.document.tracks[0].clips[0].parentId).toBe("n");
    close(world(linked.document, "c", 1000), before);
    const atLink = world(linked.document, "c", 1000);
    const unlinked = setClipParent(linked.document, "c", null, { keepVisual: true, atMs: 1000 });
    if (!unlinked.ok) throw new Error(unlinked.reason);
    expect(unlinked.document.tracks[0].clips[0].parentId).toBeUndefined();
    close(world(unlinked.document, "c", 1000), atLink);
  });

  it("keeps a curved path when linking to a turned parent", () => {
    const path = image("c", { x: 0.5, y: 0.5 }, { keyframes: { position: [{ atMs: 0, x: 0.3, y: 0.4, easing: "linear" }, { atMs: 2000, x: 0.6, y: 0.5, easing: "linear", spatial: "free", in: { x: -0.05, y: 0.02 }, out: { x: 0.05, y: 0 } }] } });
    const doc = film([[path], [nul("n", { keyframes: { rotation: [{ atMs: 0, value: 40, easing: "linear" }] } }, { x: 0.45, y: 0.55 })]]);
    const linked = setClipParent(doc, "c", "n", { keepVisual: true, atMs: 0 });
    if (!linked.ok) throw new Error(linked.reason);
    for (const at of [0, 700, 2000]) close(world(linked.document, "c", at), world(doc, "c", at), 6);
  });

  it("jumps when asked and refuses cycles, self links and sounds", () => {
    const doc = spin();
    const jumped = setClipParent(doc, "c", "n", { keepVisual: false, atMs: 0 });
    if (!jumped.ok) throw new Error(jumped.reason);
    expect(jumped.document.tracks[0].clips[0].keyframes).toEqual(doc.tracks[0].clips[0].keyframes);
    expect(setClipParent(jumped.document, "n", "c", { keepVisual: true, atMs: 0 })).toEqual({ ok: false, reason: "cycle" });
    expect(setClipParent(doc, "c", "c", { keepVisual: true, atMs: 0 })).toEqual({ ok: false, reason: "self" });
    expect(setClipParent(doc, "c", "ghost", { keepVisual: true, atMs: 0 })).toEqual({ ok: false, reason: "missing" });
    expect(parentChoices(jumped.document, ["n"]).map((clip) => clip.id)).toEqual([]);
    expect(parentChoices(doc, ["c"]).map((clip) => clip.id)).toEqual(["n"]);
  });

  it("refuses a link that would push the clip past the range", () => {
    const doc = film([[image("c", { x: 0.95, y: 0.5 })], [nul("n", {}, { x: 0.05, y: 0.5, w: 0.01, h: 0.01 })]]);
    expect(setClipParent(doc, "c", "n", { keepVisual: true, atMs: 0 })).toEqual({ ok: false, reason: "outOfRange" });
  });

  it("hands children to the next parent up when their parent is deleted", () => {
    const doc = film([[image("c", { x: 0.6, y: 0.5 }, { parentId: "mid" })], [nul("mid", { parentId: "top" }, { x: 0.55 })], [nul("top", { keyframes: { rotation: [{ atMs: 0, value: 30, easing: "linear" }] } })]]);
    const before = world(doc, "c", 0);
    const deleted = deleteClips(doc, ["mid"]);
    expect(documentIssue("video", deleted)).toBeNull();
    expect(clipLookup(deleted).get("c")!.parentId).toBe("top");
    close(world(deleted, "c", 0), before);
    const orphaned = deleteClips(deleted, ["top"]);
    expect(clipLookup(orphaned).get("c")!.parentId).toBeUndefined();
    close(world(orphaned, "c", 0), before);
  });

  it("follows the right piece after a cut and links copies made together", () => {
    const doc = film([[image("early", {}, { parentId: "n", startMs: 0, durationMs: 1000 }), image("late", {}, { parentId: "n", startMs: 2500, durationMs: 1000 })], [nul("n")]]);
    const cut = splitClip(doc, "n", 2000);
    expect(clipLookup(cut.document).get("late")!.parentId).toBe(cut.clipId);
    expect(clipLookup(cut.document).get("early")!.parentId).toBe("n");
    const single = film([[image("c", { x: 0.6 }, { parentId: "n", durationMs: 1000 })], [nul("n", { durationMs: 1000 })]]);
    const copies = duplicateClips(single, ["n", "c"]);
    const [nullCopy, childCopy] = copies.clipIds;
    expect(clipLookup(copies.document).get(childCopy)!.parentId).toBe(nullCopy);
    expect(documentIssue("video", copies.document)).toBeNull();
  });

  it("relinks pasted and duplicated families and frees a pasted child whose parent is gone", () => {
    const single = film([[image("c", { x: 0.6 }, { parentId: "n", durationMs: 1000 })], [nul("n", { durationMs: 1000 })]]);
    const family = copyClips(single, ["n", "c"])!;
    const pasted = pasteClips(single, family, 2000, "overwrite")!;
    const [nullCopy, childCopy] = pasted.ids;
    expect(clipLookup(pasted.document).get(childCopy)!.parentId).toBe(nullCopy);
    const alone = copyClips(single, ["c"])!;
    const elsewhere = film([[], []]);
    const freed = pasteClips(elsewhere, alone, 0, "overwrite")!;
    expect(clipLookup(freed.document).get(freed.ids[0])!.parentId).toBeUndefined();
    const twins = duplicateGroup(single, ["n", "c"]);
    const lookup = clipLookup(twins.document);
    expect(lookup.get(twins.clipIds[1])!.parentId).toBe(twins.clipIds[0]);
  });

  it("frees children when an overwrite clears their parent", () => {
    const doc = film([[image("c", { x: 0.6 }, { parentId: "n" })], [nul("n", { durationMs: 1000, keyframes: { rotation: [{ atMs: 0, value: 30, easing: "linear" }] } })]]);
    const before = world(doc, "c", 0);
    const cleared = clearRange(doc, "t1", 0, 1000)!;
    expect(documentIssue("video", cleared)).toBeNull();
    expect(clipLookup(cleared).get("c")!.parentId).toBeUndefined();
    close(world(cleared, "c", 0), before);
  });

  it("adds a null on the top track", () => {
    const doc = film([[image("c")], []]);
    const added = insertNull(doc, { startMs: 0, durationMs: 1000, x: 0.3, y: 0.4 });
    if (!added.ok) throw new Error(added.reason);
    expect(added.document.tracks[1].clips[0]).toMatchObject({ id: added.clipId, type: "null", transform: { x: 0.3, y: 0.4 } });
  });

  it("evaluates the same frame as the placement of the parent", () => {
    const doc = spin();
    const lookup = clipLookup(doc);
    const frame = frameAt(lookup, lookup.get("n")!, 1000, ASPECT);
    expect(frame.rotation).toBeCloseTo(30, 9);
    expect(worldPlacementAt(lookup, lookup.get("c")!, 1000, ASPECT)).toEqual(placementAt(lookup.get("c")!, 1000, ASPECT));
  });
});
