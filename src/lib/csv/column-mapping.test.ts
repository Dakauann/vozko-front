import { describe, expect, it } from "vitest";

import { assignColumn } from "./column-mapping";

describe("assignColumn", () => {
  it("moves a single use key away from the column that held it", () => {
    expect(assignColumn(["name", "", "email"], 1, "name")).toEqual(["", "name", "email"]);
  });

  it("clears a column when the key is empty", () => {
    expect(assignColumn(["name", "email"], 1, "")).toEqual(["name", ""]);
  });

  it("keeps a repeatable key on every column that chose it", () => {
    const repeatable = (key: string) => key.startsWith("phone:");
    expect(assignColumn(["phone:mobile", "", "name"], 1, "phone:mobile", repeatable)).toEqual([
      "phone:mobile",
      "phone:mobile",
      "name",
    ]);
  });

  it("still moves a single use key when other keys repeat", () => {
    const repeatable = (key: string) => key.startsWith("phone:");
    expect(assignColumn(["number", "phone:mobile", ""], 2, "number", repeatable)).toEqual([
      "",
      "phone:mobile",
      "number",
    ]);
  });

  it("ignores an index outside the columns", () => {
    expect(assignColumn(["name"], 4, "email")).toEqual(["name"]);
  });
});
