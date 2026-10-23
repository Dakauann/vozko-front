import { describe, expect, it } from "vitest";

import { mappedColumns, systemColumns } from "./columns";
import type { GoogleSheet, SheetColumn } from "./types";

function column(key: string, overrides: Partial<SheetColumn> = {}): SheetColumn {
  return { key, header: key, type: "text", required: false, source: "input", archived: false, ...overrides };
}

const sheet = {
  columns: [
    column("produto"),
    column("antigo", { archived: true }),
    column("telefone", { source: "lead_phone", type: "phone" }),
    column("registro_antigo", { source: "written_at", type: "datetime", archived: true }),
  ],
} as GoogleSheet;

describe("sheet columns", () => {
  it("maps only live columns that take input", () => {
    expect(mappedColumns(sheet).map((c) => c.key)).toEqual(["produto"]);
  });

  it("lists the live columns the system fills", () => {
    expect(systemColumns(sheet).map((c) => c.key)).toEqual(["telefone"]);
  });
});
