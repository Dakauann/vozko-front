import { describe, expect, it } from "vitest";

import { buildLeadImportTemplate } from "../template";
import { buildLeadImportRows, readLeadImportFile } from "../import";

/**
 * The example file is the one artefact an operator edits and hands back, so the
 * claim worth testing is the round trip: what we ship must parse cleanly with
 * OUR parser and reject nothing. A template that fails its own import teaches
 * the wrong format to everyone who downloads it.
 */
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
    // The guess has to come from the header names. If it silently fell back to
    // the positional default the template would still pass the test above while
    // teaching nothing about which headers the importer recognises.
    expect(file.guess).toEqual({ number: 0, name: 1, age: 2 });
  });

  it("normalises a number written with punctuation and a country code", () => {
    const file = readLeadImportFile(buildLeadImportTemplate());
    const parsed = buildLeadImportRows(file, file.guess);

    // Row two is "+55 (11) 98765-4322" precisely because an exported
    // spreadsheet looks like that, and an operator has to see it accepted.
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

    // The row exists to catch a broken delimiter or quoting change here rather
    // than on row four thousand of a customer's real file.
    expect(parsed.rows[2].name).toBe("Carla Souza; ME");
    expect(parsed.rows[2].age).toBe(41);
  });
});
