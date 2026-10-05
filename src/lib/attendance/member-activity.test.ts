import { describe, expect, it } from "vitest";

import {
  formatHoursMinutes,
  localClock,
  memberActivityPath,
  memberActivityQuery,
  memberActivitySubject,
  receivedTotal,
  sessionBar,
  hasMemberActivity,
  heatmapCells,
  type MemberActivitySession,
} from "./member-activity";

const zone = "America/Sao_Paulo";

function session(start: string, end: string, onCallMs = 0, open = false): MemberActivitySession {
  return { start, end, on_call_ms: onCallMs, open };
}

describe("memberActivityPath", () => {
  it("asks for the caller's own activity in self mode", () => {
    expect(memberActivityPath({ mode: "self" })).toBe("/attendance/members/me/activity");
  });

  it("asks for a teammate by id and escapes it", () => {
    expect(memberActivityPath({ mode: "member", memberId: "u 1" })).toBe("/attendance/members/u%201/activity");
  });
});

describe("memberActivitySubject", () => {
  it("uses the self route for the viewer's own row", () => {
    expect(memberActivitySubject("u1", "u1")).toEqual({ mode: "self" });
  });

  it("uses the member route for anyone else", () => {
    expect(memberActivitySubject("u2", "u1")).toEqual({ mode: "member", memberId: "u2" });
    expect(memberActivitySubject("u2", "")).toEqual({ mode: "member", memberId: "u2" });
  });
});

describe("memberActivityQuery", () => {
  it("sends the period and the browser timezone", () => {
    expect(memberActivityQuery({ dateFrom: "2026-09-29", dateTo: "2026-10-05" }, zone)).toBe(
      "date_from=2026-09-29&date_to=2026-10-05&timezone=America%2FSao_Paulo",
    );
  });
});

describe("localClock", () => {
  it("reads the wall clock of the report timezone, not the browser", () => {
    expect(localClock("2026-10-05T11:30:00Z", zone)).toEqual({ date: "2026-10-05", minutes: 8 * 60 + 30 });
  });

  it("moves to the previous local day when UTC already turned", () => {
    expect(localClock("2026-10-06T01:15:00Z", zone)).toEqual({ date: "2026-10-05", minutes: 22 * 60 + 15 });
  });
});

describe("sessionBar", () => {
  it("places a session over the hours of its day", () => {
    const bar = sessionBar(session("2026-10-05T11:00:00Z", "2026-10-05T17:00:00Z", 90 * 60_000), "2026-10-05", zone);
    expect(bar.offsetPct).toBeCloseTo((8 / 24) * 100);
    expect(bar.widthPct).toBeCloseTo((6 / 24) * 100);
    expect(bar.onCallShare).toBeCloseTo(0.25);
    expect(bar.crossesMidnight).toBe(false);
  });

  it("clips a session that crosses midnight at the end of its start day", () => {
    const bar = sessionBar(session("2026-10-06T00:00:00Z", "2026-10-06T05:00:00Z"), "2026-10-05", zone);
    expect(bar.offsetPct).toBeCloseTo((21 / 24) * 100);
    expect(bar.widthPct).toBeCloseTo((3 / 24) * 100);
    expect(bar.crossesMidnight).toBe(true);
  });

  it("never lets call time exceed the session", () => {
    const bar = sessionBar(session("2026-10-05T11:00:00Z", "2026-10-05T12:00:00Z", 5 * 3_600_000), "2026-10-05", zone);
    expect(bar.onCallShare).toBe(1);
  });

  it("collapses an inverted session instead of drawing a negative bar", () => {
    const bar = sessionBar(session("2026-10-05T12:00:00Z", "2026-10-05T11:00:00Z"), "2026-10-05", zone);
    expect(bar.widthPct).toBe(0);
    expect(bar.onCallShare).toBe(0);
  });
});

describe("formatHoursMinutes", () => {
  it("shows hours and padded minutes", () => {
    expect(formatHoursMinutes(3 * 3_600_000 + 5 * 60_000, "min")).toBe("3h 05min");
  });

  it("shows only minutes under an hour", () => {
    expect(formatHoursMinutes(42 * 60_000, "min")).toBe("42min");
    expect(formatHoursMinutes(0, "min")).toBe("0min");
  });
});

describe("receivedTotal", () => {
  it("sums every trigger", () => {
    expect(receivedTotal({ inbound_rr: 4, manual: 2, open: 1 })).toBe(7);
    expect(receivedTotal({})).toBe(0);
  });
});

describe("heatmapCells", () => {
  it("flattens weekday by hour minutes with their share of the busiest cell", () => {
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    grid[1][9] = 60;
    grid[2][10] = 30;
    const cells = heatmapCells(grid);
    expect(cells).toHaveLength(7 * 24);
    expect(cells.find((cell) => cell.weekday === 1 && cell.hour === 9)).toEqual({ weekday: 1, hour: 9, minutes: 60, intensity: 1 });
    expect(cells.find((cell) => cell.weekday === 2 && cell.hour === 10)?.intensity).toBe(0.5);
    expect(cells.find((cell) => cell.weekday === 0 && cell.hour === 0)?.intensity).toBe(0);
  });
});

describe("hasMemberActivity", () => {
  it("opens activity only for people, never for agents or automations", () => {
    expect(hasMemberActivity({ actor_kind: "human" })).toBe(true);
    expect(hasMemberActivity({ actor_kind: "ai" })).toBe(false);
    expect(hasMemberActivity({ actor_kind: "workflow" })).toBe(false);
    expect(hasMemberActivity({ actor_kind: "system" })).toBe(false);
  });
});
