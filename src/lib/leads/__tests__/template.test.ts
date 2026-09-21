import { describe, expect, it } from "vitest";

import { buildLeadImportTemplate } from "../template";
import { buildLeadImportRows, readLeadImportFile } from "../import";

describe("lead import template", () => {
  it("round-trips through the importer with no rejections", () => {
    const file = readLeadImportFile(buildLeadImportTemplate());
    const parsed = buildLeadImportRows(file, file.guess);

    expect(parsed.rejected).toEqual([]);
    expect(parsed.rows).toHaveLength(3);
  });

  it("is mapped from its own Portuguese header, not by column position", () => {
    const file = readLeadImportFile(buildLeadImportTemplate());

    expect(file.headers).toEqual(["telefone", "nome", "idade"]);
    expect(file.guess).toEqual({ number: 0, name: 1, age: 2 });
  });

  it("normalises a number written with punctuation and a country code", () => {
    const file = readLeadImportFile(buildLeadImportTemplate());
    const parsed = buildLeadImportRows(file, file.guess);

    expect(parsed.rows[1].number).toBe("5511987654322");
  });

  it("accepts a blank idade rather than rejecting the row", () => {
    const file = readLeadImportFile(buildLeadImportTemplate());
    const parsed = buildLeadImportRows(file, file.guess);

    expect(parsed.rows[1].age).toBeUndefined();
    expect(parsed.rows[0].age).toBe(34);
  });

  it("keeps a name containing the delimiter in one column", () => {
    const file = readLeadImportFile(buildLeadImportTemplate());
    const parsed = buildLeadImportRows(file, file.guess);

    expect(parsed.rows[2].name).toBe("Carla Souza; ME");
    expect(parsed.rows[2].age).toBe(41);
  });
});
