import { describe, expect, it } from "vitest";

import type { Artboard } from "../document";
import { artboardTarget, lookClock, momentsTarget } from "./look-target";

function board(id: string, name?: string): Artboard {
  return { id, name, x: 0, y: 0, canvas: { width: 100, height: 100, background: "#ffffff" }, layers: [] } as unknown as Artboard;
}

describe("what Elo looked at", () => {
  it("spans the sampled moments from the first to the last", () => {
    expect(momentsTarget([5000, 3000, 4200])).toEqual({ kind: "moments", fromMs: 3000, toMs: 5000 });
    expect(momentsTarget([1000.4, 2999.6])).toEqual({ kind: "moments", fromMs: 1000, toMs: 3000 });
  });

  it("names an artboard by its place and its own name, kept within what the server accepts", () => {
    const boards = [board("a"), board("b", "  Capa  "), board("c", "x\ny".padEnd(200, "z"))];
    expect(artboardTarget(boards, boards[0])).toEqual({ kind: "artboard", artboardId: "a", n: 1 });
    expect(artboardTarget(boards, boards[1])).toEqual({ kind: "artboard", artboardId: "b", n: 2, name: "Capa" });
    const long = artboardTarget(boards, boards[2]);
    expect(long.kind === "artboard" && [...(long.name ?? "")].length).toBe(120);
    expect(long.kind === "artboard" && long.name?.startsWith("x y")).toBe(true);
  });

  it("reads seconds for long stretches and tenths for close moments", () => {
    expect(lookClock({ fromMs: 3000, toMs: 5400 })).toEqual(["0:03", "0:05"]);
    expect(lookClock({ fromMs: 3200, toMs: 3800 })).toEqual(["0:03.2", "0:03.8"]);
    expect(lookClock({ fromMs: 3000, toMs: 3000 })).toEqual(["0:03"]);
    expect(lookClock({ fromMs: 62_000, toMs: 125_000 })).toEqual(["1:02", "2:05"]);
  });
});
