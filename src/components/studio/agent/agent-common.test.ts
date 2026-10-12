import { describe, expect, it } from "vitest";

import { MAX_SCREEN_MESSAGE } from "@/lib/aichat/screen";
import type { LibraryLookup } from "@/lib/studio/agent/element-ops";

import { appliedReport, BATCH_HELD, CONCURRENT_SKIP, DEPENDS_ON_REFUSED, flagArg, invalidResultRefusal, libraryFor, parseFollow, planRefusal, REASON_CUT, seenReply, spreadReport, withTimeout } from "./agent-common";
import { createLookShots } from "./look-shots";

const PURPOSES = ["captions", "music"] as const;

describe("parseFollow", () => {
  it("accepts a job hand off with its placement", () => {
    const follow = parseFollow({ job: { id: "j1", kind: "music", status: "queued" }, purpose: "music", atMs: 2000, trackId: "t1" }, PURPOSES);
    expect(follow).toMatchObject({ purpose: "music", atMs: 2000, trackId: "t1", job: { id: "j1", kind: "music", status: "queued" } });
  });

  it("refuses anything it does not recognise, so the editor never follows a bogus job", () => {
    expect(parseFollow(null, PURPOSES)).toBeNull();
    expect(parseFollow({ job: { id: "j1", kind: "music", status: "queued" }, purpose: "export" }, PURPOSES)).toBeNull();
    expect(parseFollow({ job: { id: "", kind: "music", status: "queued" }, purpose: "music" }, PURPOSES)).toBeNull();
    expect(parseFollow({ job: { id: "j1", kind: "music", status: "weird" }, purpose: "music" }, PURPOSES)).toBeNull();
  });

  it("recognises a sound effect job", () => {
    expect(parseFollow({ job: { id: "j2", kind: "sfx", status: "running" }, purpose: "sfx", atMs: 500 }, ["sfx"] as const)).toMatchObject({ purpose: "sfx", atMs: 500, job: { kind: "sfx" } });
  });

  it("keeps what the job started from, so a replaced picture is never overwritten", () => {
    expect(parseFollow({ job: { id: "j1", kind: "cutout", status: "queued", sourceMediaId: "foto" }, purpose: "captions" }, PURPOSES)?.job).toMatchObject({ sourceMediaId: "foto", referenceMediaIds: [] });
    expect(parseFollow({ job: { id: "j1", kind: "image", status: "queued", referenceMediaIds: ["foto", "estilo"] }, purpose: "music" }, PURPOSES)?.job).toMatchObject({ referenceMediaIds: ["foto", "estilo"] });
    const odd = parseFollow({ job: { id: "j1", kind: "image", status: "queued", sourceMediaId: 3, referenceMediaIds: ["foto", 4] }, purpose: "music" }, PURPOSES)?.job;
    expect(odd?.sourceMediaId).toBeUndefined();
    expect(odd?.referenceMediaIds).toEqual([]);
  });

  it("drops placement values of the wrong type", () => {
    expect(parseFollow({ job: { id: "j1", kind: "captions", status: "queued" }, purpose: "captions", atMs: "soon", clipId: 4 }, PURPOSES)).toMatchObject({ atMs: undefined, clipId: undefined });
  });
});

describe("flagArg", () => {
  it("is on only for a literal true", () => {
    expect(flagArg({ marks: true }, "marks")).toBe(true);
    expect(flagArg({ marks: "true" }, "marks")).toBe(false);
    expect(flagArg(undefined, "marks")).toBe(false);
  });
});

describe("withTimeout", () => {
  it("gives up on slow facts instead of blocking Elo", async () => {
    await expect(withTimeout(new Promise((resolve) => setTimeout(() => resolve("late"), 50)), 5)).resolves.toBeUndefined();
    await expect(withTimeout(Promise.resolve("fast"), 50)).resolves.toBe("fast");
  });
});

describe("libraryFor", () => {
  const lookup: LibraryLookup = { items: new Map(), text: () => "", locale: "pt-BR" };

  it("loads the library for add_element and for add_icon with an id outside the catalog", async () => {
    let loads = 0;
    const load = async () => {
      loads += 1;
      return lookup;
    };
    await expect(libraryFor([{ op: "add_icon", icon_id: "star" }], load, ["star"])).resolves.toBeUndefined();
    expect(loads).toBe(0);
    await expect(libraryFor([{ op: "add_icon", icon_id: "icon-truck-regular" }], load, ["star"])).resolves.toBe(lookup);
    await expect(libraryFor([{ op: "add_element", item_id: "shape-heart" }], load, ["star"])).resolves.toBe(lookup);
    expect(loads).toBe(2);
  });
});

const SEVEN = ["add_text", "add_shape", "update_layer", "update_layer", "trim_clip", "update_clip", "animate"].map((op) => ({ op }));

describe("planRefusal", () => {
  it("states in separate fields that nothing was applied, what was refused and why, and what waited", () => {
    const reply = planRefusal(
      {
        ok: false,
        index: 1,
        op: "add_shape",
        reason: "a",
        failures: [
          { index: 1, op: "add_shape", reason: "path precisa ser um caminho SVG" },
          { index: 4, op: "trim_clip", reason: "o clipe (sem id) não existe" },
        ],
        skipped: [5, 6],
      },
      SEVEN,
    );
    if (reply.ok) throw new Error("expected a refusal");
    expect(reply.error.message).toContain("Nada foi aplicado");
    expect(reply.error.message).toContain("2 de 7");
    expect(reply.data).toEqual({
      applied: [],
      refused: [
        { operation: 2, op: "add_shape", reason: "path precisa ser um caminho SVG" },
        { operation: 5, op: "trim_clip", reason: "o clipe (sem id) não existe" },
      ],
      not_applied: [
        { operation: 1, op: "add_text", reason: BATCH_HELD },
        { operation: 3, op: "update_layer", reason: BATCH_HELD },
        { operation: 4, op: "update_layer", reason: BATCH_HELD },
        { operation: 6, op: "update_clip", reason: DEPENDS_ON_REFUSED },
        { operation: 7, op: "animate", reason: DEPENDS_ON_REFUSED },
      ],
    });
  });

  it("keeps every refused operation listed but bounds how much reason text it sends", () => {
    const failures = Array.from({ length: 40 }, (_, i) => ({ index: i, op: "update_layer", reason: "x".repeat(150) }));
    const reply = planRefusal({ ok: false, index: 0, op: "update_layer", reason: "x", failures, skipped: [] }, failures.map(() => ({ op: "update_layer" })));
    if (reply.ok) throw new Error("expected a refusal");
    const refused = (reply.data as { refused: { operation: number; reason: string }[] }).refused;
    expect(refused).toHaveLength(40);
    expect(refused.filter((entry) => entry.reason !== REASON_CUT).reduce((total, entry) => total + entry.reason.length, 0)).toBeLessThanOrEqual(MAX_SCREEN_MESSAGE);
    expect(refused.at(-1)?.reason).toBe(REASON_CUT);
  });
});

describe("invalidResultRefusal", () => {
  it("names the operation that would break the document as refused and the rest as not applied", () => {
    const steps = [0, 1].map((operation) => ({ document: { n: operation }, focus: { kind: "canvas" as const }, label: "x", operation }));
    const reply = invalidResultRefusal(steps, [{ op: "add_text" }, { op: "update_layer" }], (doc) => (doc.n === 1 ? { ok: false as const, issue: { field: "document.layers" as const, code: "out_of_range" as const } } : { ok: true as const }));
    if (!reply || reply.ok) throw new Error("expected a refusal");
    expect(reply.error.message).toContain("Nada foi aplicado");
    expect(reply.data).toMatchObject({ applied: [], refused: [{ operation: 2, op: "update_layer" }], not_applied: [{ operation: 1, op: "add_text", reason: BATCH_HELD }] });
  });
});

describe("appliedReport", () => {
  const plan = { steps: [0, 1, 2].map((operation) => ({ document: {}, focus: { kind: "canvas" as const }, label: "x", operation })), spread: [] };

  it("lists every operation as applied when the whole batch landed", () => {
    expect(appliedReport(plan, [{ op: "a" }, { op: "b" }, { op: "c" }], { conflicts: [], skipped: [] })).toEqual({ applied: [1, 2, 3] });
  });

  it("separates the operations that did not land because the person edited the same thing", () => {
    expect(appliedReport(plan, [{ op: "a" }, { op: "b" }, { op: "c" }], { conflicts: [], skipped: [1] })).toEqual({
      applied: [1, 3],
      not_applied: [{ operation: 2, op: "b", reason: CONCURRENT_SKIP }],
    });
  });

  it("reports an operation spread over several artboards, per artboard", () => {
    const spread = [{ operation: 0, op: "update_layer", artboards: [{ artboard: "a1", ids: ["l1"] }, { artboard: "a2", ids: ["l2", "l3"] }] }];
    expect(spreadReport({ ...plan, spread })).toEqual({
      per_artboard: [{ operation: 1, op: "update_layer", artboards: [{ artboard_id: "a1", layers: ["l1"] }, { artboard_id: "a2", layers: ["l2", "l3"] }] }],
    });
    expect(spreadReport(plan)).toEqual({});
  });
});

describe("seenReply", () => {
  it("keeps the picture it sends to the model and names what was seen", () => {
    const shots = createLookShots();
    const reply = seenReply({ shots }, { frames: [] }, "data:image/jpeg;base64,AA", { kind: "moments", fromMs: 0, toMs: 900 });
    expect(reply).toEqual({ ok: true, data: { frames: [] }, images: ["data:image/jpeg;base64,AA"], target: { kind: "moments", fromMs: 0, toMs: 900 } });
    expect(shots.store.getState().shots[0]).toMatchObject({ image: "data:image/jpeg;base64,AA", target: { kind: "moments" } });
  });
});
