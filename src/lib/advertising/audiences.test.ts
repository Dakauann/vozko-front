import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOOKALIKE_COUNTRY,
  countryOptions,
  assignColumn,
  audienceSize,
  audienceState,
  clampLookalikePercent,
  detectDelimiter,
  emptySavedAudience,
  genderChoiceOf,
  gendersOf,
  originCandidates,
  guessKeyFromHeader,
  guessKeyFromValues,
  hasIdentifyingColumn,
  looksLikeHeader,
  parseCsv,
  previewCsv,
} from "./audiences";

describe("audienceSize", () => {
  it("reports Meta's -1 as still calculating", () => {
    expect(audienceSize({ approxLower: -1, approxUpper: -1 })).toEqual({ kind: "calculating" });
  });

  it("keeps a real range and orders it", () => {
    expect(audienceSize({ approxLower: 1000, approxUpper: 1200 })).toEqual({ kind: "range", lower: 1000, upper: 1200 });
    expect(audienceSize({ approxLower: 1000, approxUpper: 900 })).toEqual({ kind: "range", lower: 1000, upper: 1000 });
  });

  it("does not invent a size from zeros", () => {
    expect(audienceSize({ approxLower: 0, approxUpper: 0 })).toEqual({ kind: "unknown" });
  });
});

describe("audienceState", () => {
  it("maps the delivery codes", () => {
    expect(audienceState({ deliveryCode: 200, operationCode: 200 })).toBe("ready");
    expect(audienceState({ deliveryCode: 300, operationCode: 200 })).toBe("too_small");
    expect(audienceState({ deliveryCode: 400, operationCode: 411 })).toBe("processing");
    expect(audienceState({ deliveryCode: 400, operationCode: 200 })).toBe("unavailable");
  });
});

describe("clampLookalikePercent", () => {
  it("keeps the 1 to 10 range", () => {
    expect(clampLookalikePercent(0)).toBe(1);
    expect(clampLookalikePercent(4.4)).toBe(4);
    expect(clampLookalikePercent(15)).toBe(10);
    expect(clampLookalikePercent(Number.NaN)).toBe(1);
  });
});

describe("parseCsv", () => {
  it("detects the delimiter from the first line", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(detectDelimiter("a,b\n1,2")).toBe(",");
    expect(detectDelimiter('"x;y",b,c')).toBe(",");
  });

  it("handles quotes, escaped quotes, CRLF, a BOM and blank lines", () => {
    const text = '﻿nome,email\r\n"Silva, Ana","ana@x.com"\r\n\r\n"Diz ""oi""",b@y.com\r\n';
    expect(parseCsv(text)).toEqual([
      ["nome", "email"],
      ["Silva, Ana", "ana@x.com"],
      ['Diz "oi"', "b@y.com"],
    ]);
  });

  it("stops at the row limit", () => {
    expect(parseCsv("a\nb\nc\nd", 2)).toEqual([["a"], ["b"]]);
  });
});

describe("column guessing", () => {
  it("reads common header names in every language", () => {
    expect(guessKeyFromHeader("E-mail")).toBe("EMAIL");
    expect(guessKeyFromHeader("Telefone celular")).toBe("PHONE");
    expect(guessKeyFromHeader("CEP")).toBe("ZIP");
    expect(guessKeyFromHeader("Sobrenome")).toBe("LN");
    expect(guessKeyFromHeader("País")).toBe("COUNTRY");
    expect(guessKeyFromHeader("Observações")).toBe("");
  });

  it("falls back to the shape of the values", () => {
    expect(guessKeyFromValues(["ana@x.com", "b@y.com", ""])).toBe("EMAIL");
    expect(guessKeyFromValues(["+55 (11) 98888-7777", "11977776666"])).toBe("PHONE");
    expect(guessKeyFromValues(["São Paulo", "Rio"])).toBe("");
  });

  it("tells a header row from a data row", () => {
    expect(looksLikeHeader([["nome", "email"], ["Ana", "ana@x.com"]])).toBe(true);
    expect(looksLikeHeader([["Ana", "ana@x.com"], ["Bia", "b@y.com"]])).toBe(false);
    expect(looksLikeHeader([["coluna a", "coluna b"], ["x", "11988887777"]])).toBe(true);
  });
});

describe("previewCsv", () => {
  const csv = "Nome;E-mail;Telefone;Cliente desde\nAna;ana@x.com;11988887777;2020\nBia;b@y.com;11977776666;2021";

  it("detects the header and maps the columns", () => {
    const preview = previewCsv(csv);
    expect(preview.hasHeader).toBe(true);
    expect(preview.headers).toEqual(["Nome", "E-mail", "Telefone", "Cliente desde"]);
    expect(preview.rows).toHaveLength(2);
    expect(preview.columns).toEqual(["FN", "EMAIL", "PHONE", ""]);
  });

  it("guesses from values when the file has no header", () => {
    const preview = previewCsv("ana@x.com,11988887777\nb@y.com,11977776666");
    expect(preview.hasHeader).toBe(false);
    expect(preview.rows).toHaveLength(2);
    expect(preview.columns).toEqual(["EMAIL", "PHONE"]);
  });

  it("lets the caller force the header choice", () => {
    expect(previewCsv(csv, false).rows).toHaveLength(3);
  });

  it("never maps one key to two columns", () => {
    expect(previewCsv("email,e-mail\na@x.com,b@y.com").columns).toEqual(["EMAIL", ""]);
  });
});

describe("assignColumn and hasIdentifyingColumn", () => {
  it("moves a key away from the column that had it", () => {
    expect(assignColumn(["EMAIL", "", "FN"], 1, "EMAIL")).toEqual(["", "EMAIL", "FN"]);
    expect(assignColumn(["EMAIL", "PHONE"], 1, "")).toEqual(["EMAIL", ""]);
  });

  it("needs an email, phone or external id", () => {
    expect(hasIdentifyingColumn(["FN", "LN"])).toBe(false);
    expect(hasIdentifyingColumn(["FN", "PHONE"])).toBe(true);
    expect(hasIdentifyingColumn(["EXTERN_ID"])).toBe(true);
  });
});

describe("saved audience helpers", () => {
  it("round trips the gender choice through Meta's codes", () => {
    expect(genderChoiceOf(undefined)).toBe("all");
    expect(genderChoiceOf([1, 2])).toBe("all");
    expect(genderChoiceOf(gendersOf("male"))).toBe("male");
    expect(genderChoiceOf(gendersOf("female"))).toBe("female");
    expect(gendersOf("all")).toBeUndefined();
  });

  it("starts with adults, every gender and Advantage+ on", () => {
    expect(emptySavedAudience().targeting).toEqual({ locations: [], ageMin: 18, ageMax: 65, advantageAudience: true });
  });

  it("never offers a lookalike as the origin of another", () => {
    const base = { approxLower: 0, approxUpper: 0, deliveryCode: 200, operationCode: 200, name: "x" };
    const list = originCandidates([
      { ...base, metaId: "1", kind: "CUSTOMER_LIST" },
      { ...base, metaId: "2", kind: "LOOKALIKE" },
    ]);
    expect(list.map((audience) => audience.metaId)).toEqual(["1"]);
  });
});

describe("countryOptions", () => {
  it("names each country in the reader's language and keeps the codes", () => {
    const options = countryOptions("pt", ["US", "BR"]);
    expect(options.map((option) => option.code)).toEqual(["BR", "US"]);
    expect(options[0].name).toBe("Brasil");
  });

  it("offers Brazil, the default, in the full list", () => {
    expect(countryOptions("en").some((option) => option.code === DEFAULT_LOOKALIKE_COUNTRY)).toBe(true);
  });
});
