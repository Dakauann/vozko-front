import { describe, expect, it } from "vitest";

import {
  currencyOffset,
  formatDecimal,
  formatCount,
  formatMicros,
  formatMinor,
  formatPercent,
  formatRoas,
  inputToMinor,
  minorToInput,
} from "./money";

const plain = (value: string) => value.replace(/\s/g, " ");

describe("currencyOffset", () => {
  it("mirrors the backend offset table", () => {
    expect(currencyOffset("BRL")).toBe(100);
    expect(currencyOffset("usd")).toBe(100);
    expect(currencyOffset("JPY")).toBe(1);
    expect(currencyOffset("CLP")).toBe(1);
    expect(currencyOffset("R$")).toBeNull();
    expect(currencyOffset("")).toBeNull();
  });
});

describe("formatMicros", () => {
  it("formats micros in the account currency", () => {
    expect(plain(formatMicros(12_500_000, "BRL"))).toBe("R$ 12,50");
    expect(plain(formatMicros(0, "BRL"))).toBe("R$ 0,00");
  });

  it("shows a unit price with the digits it needs", () => {
    expect(plain(formatMicros(62_500, "USD", "pt-BR", 4))).toBe("US$ 0,0625");
  });

  it("shows a dash for unknown values, never zero", () => {
    expect(formatMicros(null, "BRL")).toBe("n/d");
    expect(formatMicros(undefined, "BRL")).toBe("n/d");
    expect(formatMicros(1_000_000, "")).toBe("n/d");
  });
});

describe("formatMinor", () => {
  it("formats budgets in minor units", () => {
    expect(plain(formatMinor(5000, "BRL"))).toBe("R$ 50,00");
    expect(plain(formatMinor(5000, "JPY", "en-US"))).toBe("¥5,000");
  });
});

describe("inputToMinor", () => {
  it("parses Brazilian and plain decimals", () => {
    expect(inputToMinor("50", "BRL")).toBe(5000);
    expect(inputToMinor("12,5", "BRL")).toBe(1250);
    expect(inputToMinor("12.50", "BRL")).toBe(1250);
    expect(inputToMinor("1.000,99", "BRL")).toBe(100099);
    expect(inputToMinor("1.000", "BRL")).toBe(100000);
    expect(inputToMinor("1500", "JPY")).toBe(1500);
  });

  it("refuses empty, negative, zero and garbage input", () => {
    expect(inputToMinor("", "BRL")).toBeNull();
    expect(inputToMinor("0", "BRL")).toBeNull();
    expect(inputToMinor("-5", "BRL")).toBeNull();
    expect(inputToMinor("abc", "BRL")).toBeNull();
    expect(inputToMinor("10", "")).toBeNull();
  });

  it("round trips through the input format", () => {
    expect(minorToInput(1250, "BRL")).toBe("12,50");
    expect(inputToMinor(minorToInput(1250, "BRL"), "BRL")).toBe(1250);
    expect(minorToInput(0, "BRL")).toBe("");
  });
});

describe("number formats", () => {
  it("keeps null as a dash", () => {
    expect(formatCount(null)).toBe("n/d");
    expect(formatPercent(null)).toBe("n/d");
    expect(formatRoas(null)).toBe("n/d");
  });

  it("formats counts, percentages and ROAS", () => {
    expect(formatCount(12345)).toBe("12.345");
    expect(formatPercent(1.234)).toBe("1,23%");
    expect(formatRoas(3.5)).toBe("3,50x");
  });
});

describe("formatDecimal", () => {
  it("formats with fixed digits and leaves unknown values empty", () => {
    expect(formatDecimal(1.5, "pt-BR")).toBe("1,50");
    expect(formatDecimal(7.25, "en-US", 1)).toBe("7.3");
    expect(formatDecimal(null)).toBe("n/d");
    expect(formatCount(null, "en-US")).toBe("n/a");
  });
});
