import { describe, expect, it } from "vitest";

import { canTest, cellsFor, evenShares, sharesTotal, testWindow } from "./ab-test";

const TZ = "America/Sao_Paulo";

describe("cells", () => {
  it("allows two to five objects", () => {
    expect(canTest(1)).toBe(false);
    expect(canTest(2)).toBe(true);
    expect(canTest(5)).toBe(true);
    expect(canTest(6)).toBe(false);
  });

  it("splits shares evenly and gives the remainder to the first cell, like Meta", () => {
    expect(evenShares(3)).toEqual([34, 33, 33]);
    expect(evenShares(4)).toEqual([25, 25, 25, 25]);
    expect(sharesTotal(cellsFor([{ metaId: "1", name: "A" }, { metaId: "2", name: "B" }, { metaId: "3", name: "C" }]))).toBe(100);
  });

  it("builds one cell per selected object", () => {
    expect(cellsFor([{ metaId: "1", name: "A" }, { metaId: "2", name: "B" }])).toEqual([
      { name: "A", objectIds: ["1"], share: 50 },
      { name: "B", objectIds: ["2"], share: 50 },
    ]);
  });
});

describe("testWindow", () => {
  const now = new Date("2026-10-02T15:00:00Z");

  it("starts at midnight of a future day and ends after the last day, in the account timezone", () => {
    expect(testWindow("2026-10-05", "2026-10-11", "2026-10-02", TZ, now)).toEqual({
      startAt: "2026-10-05T03:00:00.000Z",
      endAt: "2026-10-12T03:00:00.000Z",
    });
  });

  it("starts a few minutes from now when the test begins today", () => {
    expect(testWindow("2026-10-02", "2026-10-05", "2026-10-02", TZ, now)).toEqual({
      startAt: "2026-10-02T15:10:00.000Z",
      endAt: "2026-10-06T03:00:00.000Z",
    });
  });

  it("refuses past starts, reversed ranges and tests longer than 30 days", () => {
    expect(testWindow("2026-10-01", "2026-10-05", "2026-10-02", TZ, now)).toEqual({ problem: "dates" });
    expect(testWindow("2026-10-05", "2026-10-04", "2026-10-02", TZ, now)).toEqual({ problem: "endBeforeStart" });
    expect(testWindow("2026-10-03", "2026-11-02", "2026-10-02", TZ, now)).toEqual({ problem: "tooLong" });
  });
});
