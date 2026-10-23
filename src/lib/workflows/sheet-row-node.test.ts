import { describe, expect, it } from "vitest";

import { readSheetRowConfig } from "./sheet-row-node";

describe("readSheetRowConfig", () => {
  it("reads the sheet and the column values", () => {
    expect(readSheetRowConfig({ sheet_id: "s1", values: { produto: "{{var.produto}}", quantidade: 3 } })).toEqual({
      sheetId: "s1",
      values: { produto: "{{var.produto}}", quantidade: "3" },
    });
  });

  it("reads an empty config as no sheet and no values", () => {
    expect(readSheetRowConfig({})).toEqual({ sheetId: "", values: {} });
    expect(readSheetRowConfig({ sheet_id: 4, values: ["x"] })).toEqual({ sheetId: "", values: {} });
  });
});
