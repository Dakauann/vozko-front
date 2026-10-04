import { describe, expect, it } from "vitest";

import { DEFAULT_SHEET_WIDTH, MAX_SHEET_WIDTH, MIN_PAGE_WIDTH, MIN_SHEET_WIDTH, parseStoredWidth, sheetLayout } from "./sheet-width";

describe("sheetLayout", () => {
  it("pushes the page and keeps the width the user chose when there is room", () => {
    expect(sheetLayout(520, 1920, 208)).toEqual({ mode: "push", width: 520 });
  });

  it("keeps the sheet between its limits", () => {
    expect(sheetLayout(200, 1920, 208).width).toBe(MIN_SHEET_WIDTH);
    expect(sheetLayout(900, 1920, 208).width).toBe(MAX_SHEET_WIDTH);
  });

  it("narrows the sheet before it squeezes the page", () => {
    const viewport = 208 + MIN_PAGE_WIDTH + 450;
    expect(sheetLayout(MAX_SHEET_WIDTH, viewport, 208)).toEqual({ mode: "push", width: 450 });
  });

  it("covers the whole width only when the page and the sheet cannot both fit", () => {
    expect(sheetLayout(480, 390, 0)).toEqual({ mode: "full", width: 390 });
    expect(sheetLayout(480, 208 + MIN_PAGE_WIDTH + MIN_SHEET_WIDTH - 1, 208).mode).toBe("full");
  });

  it("counts the sidebar, so a collapsed one leaves room to push", () => {
    expect(sheetLayout(480, 1280, 208).mode).toBe("push");
    expect(sheetLayout(480, 1100, 52).mode).toBe("push");
  });
});

describe("parseStoredWidth", () => {
  it("reads a stored width and ignores anything else", () => {
    expect(parseStoredWidth("520")).toBe(520);
    expect(parseStoredWidth(null)).toBeNull();
    expect(parseStoredWidth("abc")).toBeNull();
    expect(parseStoredWidth("-3")).toBeNull();
    expect(parseStoredWidth('{"width":480,"height":720}')).toBeNull();
  });

  it("starts from a readable default", () => {
    expect(DEFAULT_SHEET_WIDTH).toBeGreaterThanOrEqual(MIN_SHEET_WIDTH);
  });
});
