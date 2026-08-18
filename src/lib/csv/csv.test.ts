import { describe, expect, it } from "vitest";

import {
    buildCsvDocument,
    csvFilename,
    csvNumber,
    escapeCsvCell,
    safeCsvText,
    UTF8_BOM,
} from "./csv";

describe("safeCsvText", () => {
    // Excel and Sheets execute a cell that starts with one of these, and the
    // names reaching an export are typed by people.
    it.each(["=cmd|'/c calc'!A1", "+1+1", "-1+1", "@SUM(A1)", "\tx"])(
        "defuses the formula trigger %j",
        (payload) => {
            expect(safeCsvText(payload)).toBe(`'${payload}`);
        },
    );

    it("leaves ordinary text alone", () => {
        expect(safeCsvText("Suporte Nível 1")).toBe("Suporte Nível 1");
        expect(safeCsvText("")).toBe("");
    });

    it("flattens newlines so one record stays one line", () => {
        expect(safeCsvText("linha1\r\nlinha2\nlinha3\rlinha4")).toBe(
            "linha1 linha2 linha3 linha4",
        );
    });
});

describe("escapeCsvCell", () => {
    it("quotes the delimiter, quotes and newlines", () => {
        expect(escapeCsvCell("a;b")).toBe('"a;b"');
        expect(escapeCsvCell('he said "hi"')).toBe('"he said ""hi"""');
        // Already flattened by safeCsvText, so it never needs a quoted newline.
        expect(escapeCsvCell("a\nb")).toBe("a b");
    });

    // Quoting on the decimal mark would hand Excel text where the whole point
    // is that the cell arrives as a number.
    it("does not quote the decimal mark", () => {
        expect(escapeCsvCell("Ana, Silva")).toBe("Ana, Silva");
        expect(escapeCsvCell(30.05)).toBe("30,05");
    });

    it("quotes padded text so parsers cannot trim it away", () => {
        expect(escapeCsvCell("  spaced  ")).toBe('"  spaced  "');
    });

    it("renders empties, numbers and booleans", () => {
        expect(escapeCsvCell(null)).toBe("");
        expect(escapeCsvCell(undefined)).toBe("");
        expect(escapeCsvCell(0)).toBe("0");
        expect(escapeCsvCell(12.345)).toBe("12,35");
        expect(escapeCsvCell(true)).toBe("true");
    });

    it("still defuses a formula that also needs quoting", () => {
        expect(escapeCsvCell('=HYPERLINK("http://x","y")')).toBe(
            '"\'=HYPERLINK(""http://x"",""y"")"',
        );
    });
});

describe("csvNumber", () => {
    it("uses a comma decimal and no grouping, so pt-BR Excel reads a number", () => {
        expect(csvNumber(1234.5)).toBe("1234,5");
        expect(csvNumber(10)).toBe("10");
        expect(csvNumber(0.129)).toBe("0,13");
    });

    it("renders absent values as empty, never as zero", () => {
        expect(csvNumber(null)).toBe("");
        expect(csvNumber(undefined)).toBe("");
        expect(csvNumber(Number.NaN)).toBe("");
        expect(csvNumber(Number.POSITIVE_INFINITY)).toBe("");
    });
});

describe("buildCsvDocument", () => {
    it("emits BOM, CRLF, and a blank line between sections", () => {
        const out = buildCsvDocument([
            { title: "Sec A", header: ["k", "v"], rows: [["a", 1]] },
            { header: ["x"], rows: [["y"]] },
        ]);
        expect(out.startsWith(UTF8_BOM)).toBe(true);
        expect(out.slice(UTF8_BOM.length)).toBe(
            "Sec A\r\nk;v\r\na;1\r\n\r\nx\r\ny\r\n",
        );
    });

    it("skips empty sections instead of leaving a hole", () => {
        const out = buildCsvDocument([{ rows: [] }, { header: ["x"], rows: [["y"]] }], false);
        expect(out).toBe("x\r\ny\r\n");
    });

    it("returns nothing for no content", () => {
        expect(buildCsvDocument([], false)).toBe("");
    });
});

describe("csvFilename", () => {
    it("joins parts and strips anything path- or header-unsafe", () => {
        expect(csvFilename("atendimento", "2026-08-01", "2026-08-17")).toBe(
            "atendimento-2026-08-01-2026-08-17.csv",
        );
        // Non-ASCII is dropped rather than transliterated, matching
        // sanitizeFilenamePart on the server. What matters is that no path
        // separator or header-breaking byte survives.
        const risky = csvFilename("rel atório/../x", undefined, "");
        expect(risky).toBe("rel-at-rio-..-x.csv");
        expect(risky).not.toMatch(/[/\\"\r\n]/);
        expect(csvFilename()).toBe("export.csv");
    });
});
