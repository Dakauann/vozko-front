import { describe, expect, it } from "vitest";

import { emptyGrid, gridIsEmpty, gridToSchedule, scheduleToGrid, selectedHours, setCell, setDay, setHour } from "./wizard-schedule";

describe("schedule grid", () => {
  it("merges contiguous hours and groups days with the same range", () => {
    let grid = emptyGrid();
    for (const day of [1, 2]) {
      for (const hour of [9, 10, 11]) grid = setCell(grid, day, hour, true);
    }
    grid = setCell(grid, 1, 14, true);
    expect(gridToSchedule(grid)).toEqual([
      { days: [1, 2], startMinute: 540, endMinute: 720 },
      { days: [1], startMinute: 840, endMinute: 900 },
    ]);
  });

  it("closes a range at midnight", () => {
    expect(gridToSchedule(setCell(emptyGrid(), 6, 23, true))).toEqual([{ days: [6], startMinute: 1380, endMinute: 1440 }]);
  });

  it("round trips through day parts", () => {
    const parts = [
      { days: [0, 6], startMinute: 0, endMinute: 1440 },
      { days: [3], startMinute: 480, endMinute: 600 },
    ];
    expect(gridToSchedule(scheduleToGrid(parts))).toEqual(parts);
  });

  it("toggles whole days and hours", () => {
    const grid = setHour(setDay(emptyGrid(), 2, true), 5, true);
    expect(selectedHours(grid)).toBe(24 + 6);
    expect(gridIsEmpty(emptyGrid())).toBe(true);
    expect(gridIsEmpty(grid)).toBe(false);
  });

  it("ignores invalid days", () => {
    expect(gridIsEmpty(scheduleToGrid([{ days: [9], startMinute: 0, endMinute: 60 }]))).toBe(true);
  });
});
