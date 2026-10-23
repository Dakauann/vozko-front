import { describe, expect, it } from "vitest";

import { VISION_BUDGET } from "@/lib/vision/sheet";

import type { Document } from "../types";
import { focusBox, lookRequestOf, markLegend, sliceSheet } from "./look";

describe("lookRequestOf", () => {
  it("reads the look the backend asked for", () => {
    expect(lookRequestOf({ html: "<p/>", device: "both", scheme: "dark", focus_id: "hero", marks: true })).toEqual({ html: "<p/>", devices: ["desktop", "mobile"], dark: true, focusId: "hero", marks: true });
    expect(lookRequestOf({ html: "<p/>", device: "mobile", scheme: "light" })).toEqual({ html: "<p/>", devices: ["mobile"], dark: false, focusId: null, marks: false });
  });

  it("refuses a request without the rendered email or with unknown modes", () => {
    expect(lookRequestOf({ device: "both", scheme: "light" })).toBeNull();
    expect(lookRequestOf({ html: "<p/>", device: "tablet", scheme: "light" })).toBeNull();
    expect(lookRequestOf({ html: "<p/>", device: "both", scheme: "sepia" })).toBeNull();
  });
});

describe("sliceSheet", () => {
  it("cuts a tall email into side by side slices that stay inside the vision budget", () => {
    const sheet = sliceSheet([{ device: "desktop", width: 640, height: 3200 }]);
    expect(sheet.slices.length).toBeGreaterThan(1);
    expect(sheet.width).toBeLessThanOrEqual(VISION_BUDGET.longEdge);
    expect(sheet.height).toBeLessThanOrEqual(VISION_BUDGET.longEdge);
    expect(sheet.width * sheet.height).toBeLessThanOrEqual(VISION_BUDGET.pixels);
    const covered = sheet.slices.reduce((sum, slice) => sum + slice.height, 0);
    expect(covered).toBe(3200);
    expect(sheet.slices[0].cell.height / (3200 / sheet.slices.length)).toBeGreaterThan(0.5);
  });

  it("keeps a short email whole and puts both devices on one sheet", () => {
    const sheet = sliceSheet([
      { device: "desktop", width: 640, height: 700 },
      { device: "mobile", width: 375, height: 900 },
    ]);
    expect(sheet.slices.filter((slice) => slice.device === "desktop")).toHaveLength(1);
    expect(sheet.slices.some((slice) => slice.device === "mobile")).toBe(true);
  });
});

describe("markLegend", () => {
  it("numbers blocks in reading order, column children after their columns", () => {
    const doc: Document = {
      version: 1,
      settings: {},
      blocks: [
        { id: "title", kind: "heading", heading: { text: "Oi", level: 1 } },
        { id: "cols", kind: "columns", columns: { ratio: "50-50", columns: [{ blocks: [{ id: "left", kind: "spacer", spacer: { height: 8 } }] }, { blocks: [] }] } },
        { id: "footer", kind: "footer", footer: { company_name: "Loja", address: "Rua A" } },
      ],
    };
    expect(markLegend(doc)).toEqual([
      { n: 1, id: "title", kind: "heading" },
      { n: 2, id: "cols", kind: "columns" },
      { n: 3, id: "left", kind: "spacer" },
      { n: 4, id: "footer", kind: "footer" },
    ]);
  });
});

describe("focusBox", () => {
  it("adds a margin and stays on the page", () => {
    expect(focusBox({ left: 10, top: 100, width: 300, height: 50 }, { width: 640, height: 400 })).toEqual({ left: 0, top: 76, width: 334, height: 98 });
  });
});
