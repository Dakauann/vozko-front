import { describe, expect, it } from "vitest";

import { buildLeadImportRows, readLeadImportFile } from "./import";

function parse(raw: string) {
    const file = readLeadImportFile(raw);
    return { file, ...buildLeadImportRows(file, file.guess) };
}

describe("readLeadImportFile", () => {
    it("detects a header and maps columns by name, in any order", () => {
        const file = readLeadImportFile(
            ["nome;idade;telefone", "Ana Maria;34;11987654321"].join("\n"),
        );

        expect(file.headers).toEqual(["nome", "idade", "telefone"]);
        expect(file.guess).toEqual({ number: 2, name: 0, age: 1 });
        expect(file.rows).toHaveLength(1);
    });

    it("matches accented and capitalised headers", () => {
        const file = readLeadImportFile(
            ["Número ;Nome Completo", "11987654321;Ana"].join("\n"),
        );

        expect(file.guess.number).toBe(0);
        expect(file.guess.name).toBe(1);
    });

    it("treats a first row containing a phone number as data, not a header", () => {
        // Headerless exports are common, and eating the first row would silently
        // drop a real contact.
        const file = readLeadImportFile(
            ["11987654321;Ana", "11987654322;Bruno"].join("\n"),
        );

        expect(file.headers).toBeNull();
        expect(file.rows).toHaveLength(2);
        expect(file.guess).toEqual({ number: 0, name: 1, age: null });
    });

    it("prefers an exact header match over a substring one", () => {
        const file = readLeadImportFile(
            ["nome da campanha;nome;telefone", "Junho;Ana;11987654321"].join("\n"),
        );

        expect(file.guess.name).toBe(1);
    });

    it("still guesses a usable mapping when the header is unrecognisable", () => {
        const file = readLeadImportFile(
            ["col_a;col_b", "11987654321;Ana"].join("\n"),
        );

        expect(file.headers).toEqual(["col_a", "col_b"]);
        expect(file.guess.number).toBe(0);
        expect(file.guess.name).toBe(1);
    });
});

describe("buildLeadImportRows", () => {
    it("normalizes local-format numbers to the canonical BR form", () => {
        const { rows } = parse(
            [
                "telefone;nome",
                "11987654321;Ana",
                "(11) 98765-4322;Bruno",
                "+55 11 98765-4323;Carla",
            ].join("\n"),
        );

        expect(rows.map((r) => r.number)).toEqual([
            "5511987654321",
            "5511987654322",
            "5511987654323",
        ]);
    });

    it("reports rejected rows with the line number from the operator's file", () => {
        const { rows, rejected, invalid } = parse(
            ["telefone;nome", "11987654321;Ana", "sem telefone;Bruno"].join("\n"),
        );

        expect(rows).toHaveLength(1);
        expect(invalid).toBe(1);
        // Line 3: the header is line 1, so the bad row is where the spreadsheet
        // says it is, not where it lands after the header is stripped.
        expect(rejected).toEqual([
            { line: 3, raw: "sem telefone;Bruno", reason: "invalid" },
        ]);
    });

    it("rejects a number repeated within the same file", () => {
        const { rows, rejected, duplicates } = parse(
            [
                "telefone;nome",
                "11987654321;Ana",
                "5511987654321;Ana de novo",
            ].join("\n"),
        );

        expect(rows).toHaveLength(1);
        expect(duplicates).toBe(1);
        expect(rejected[0].reason).toBe("duplicate");
    });

    it("keeps a quoted field containing the delimiter in one cell", () => {
        const { rows } = parse(
            ['telefone;nome', '11987654321;"Silva; Ana"'].join("\n"),
        );

        expect(rows[0].name).toBe("Silva; Ana");
    });

    it("reads comma-delimited files too", () => {
        const { rows } = parse(["telefone,nome", "11987654321,Ana"].join("\n"));

        expect(rows).toEqual([
            { line: 2, number: "5511987654321", name: "Ana" },
        ]);
    });

    it("skips blank lines without shifting the line numbers that follow", () => {
        const { rows } = parse(
            ["telefone;nome", "", "11987654321;Ana"].join("\n"),
        );

        expect(rows[0].line).toBe(3);
    });

    it("drops an unusable age without costing the contact", () => {
        const { rows } = parse(
            [
                "telefone;nome;idade",
                "11987654321;Ana;34",
                "11987654322;Bruno;não sei",
                "11987654323;Carla;900",
            ].join("\n"),
        );

        expect(rows).toHaveLength(3);
        expect(rows[0].age).toBe(34);
        expect(rows[1].age).toBeUndefined();
        expect(rows[2].age).toBeUndefined();
    });

    it("omits an empty name rather than sending a blank one", () => {
        const { rows } = parse(["telefone;nome", "11987654321;   "].join("\n"));

        expect(rows[0]).toEqual({ line: 2, number: "5511987654321" });
    });

    it("handles a single-column file of nothing but numbers", () => {
        const { rows, file } = parse(["11987654321", "11987654322"].join("\n"));

        expect(file.guess.name).toBeNull();
        expect(rows).toHaveLength(2);
        expect(rows[0].name).toBeUndefined();
    });
});
