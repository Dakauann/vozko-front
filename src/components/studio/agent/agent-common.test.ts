import { describe, expect, it } from "vitest";

import { MAX_SCREEN_MESSAGE } from "@/lib/aichat/screen";

import { flagArg, parseFollow, planRefusal, withTimeout } from "./agent-common";

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

describe("planRefusal", () => {
  it("lists every failing operation and the ones skipped because of them", () => {
    const reply = planRefusal({
      ok: false,
      index: 1,
      op: "add_shape",
      reason: "a",
      failures: [
        { index: 1, op: "add_shape", reason: "path precisa ser um caminho SVG" },
        { index: 4, op: "trim_clip", reason: "o clipe (sem id) não existe" },
      ],
      skipped: [5, 6],
    });
    expect(reply.ok).toBe(false);
    if (reply.ok) return;
    expect(reply.error.message).toContain("Nada foi aplicado");
    expect(reply.error.message).toContain("operação 2 (add_shape): path precisa ser um caminho SVG");
    expect(reply.error.message).toContain("operação 5 (trim_clip): o clipe (sem id) não existe");
    expect(reply.error.message).toContain("6, 7");
  });

  it("stays within the reply limit and says how many more failed", () => {
    const failures = Array.from({ length: 40 }, (_, i) => ({ index: i, op: "update_layer", reason: "x".repeat(150) }));
    const reply = planRefusal({ ok: false, index: 0, op: "update_layer", reason: "x", failures, skipped: [] });
    if (reply.ok) throw new Error("expected a refusal");
    expect(reply.error.message.length).toBeLessThanOrEqual(MAX_SCREEN_MESSAGE);
    expect(reply.error.message).toMatch(/mais \d+/);
  });
});
