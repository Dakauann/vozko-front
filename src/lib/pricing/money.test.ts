// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  brlToUsdMicros,
  microsToUsdDisplay,
  parseAmount,
  parseBrlToUsdMicros,
  parseUsdToMicros,
  usdMicrosToBrl,
  usdMicrosToBrlInput,
  usdToMicros,
} from "./money";

describe("parseAmount", () => {
  it("parses dot and comma decimals", () => {
    expect(parseAmount("0.08")).toBe(0.08);
    expect(parseAmount("0,08")).toBe(0.08);
    expect(parseAmount("1.5")).toBe(1.5);
  });

  it("rejects invalid and negative", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-1")).toBeNull();
  });
});

describe("usd micros ↔ display", () => {
  it("round trips common catalog values", () => {
    const samples = [
      180_000_000, 90_000_000, 330_000, 6_800, 16_667, 62_500, 66_667, 4_167,
      8_333, 10_800, 13_333, 5_000, 6_667, 0,
    ];
    for (const micros of samples) {
      const display = microsToUsdDisplay(micros);
      expect(parseUsdToMicros(display)).toBe(micros);
    }
  });
});

describe("BRL conversion at rate 6", () => {
  const rate = 6;

  it("whatsapp_calls price 13333 micros ≈ R$ 0.08", () => {
    const brl = usdMicrosToBrl(13_333, rate);
    expect(brl).toBeCloseTo(0.079998, 5);
    // Convert back: R$ 0.08 → micros
    expect(brlToUsdMicros(0.08, rate)).toBe(13_333);
  });

  it("round trips micros → BRL input → micros", () => {
    const samples = [
      13_333, 8_333, 16_667, 66_667, 6_800, 108_000_000, 396_000,
    ];
    for (const micros of samples) {
      const input = usdMicrosToBrlInput(micros, rate);
      const back = parseBrlToUsdMicros(input, rate);
      expect(back).toBe(micros);
    }
  });

  it("utility message price", () => {
    // 16667 micros = $0.016667 → R$ 0.100002
    const brl = usdMicrosToBrl(16_667, rate);
    expect(brl).toBeCloseTo(0.100002, 5);
    expect(parseBrlToUsdMicros(usdMicrosToBrlInput(16_667, rate), rate)).toBe(
      16_667,
    );
  });
});

describe("edge rates", () => {
  it("zero rate yields 0 micros", () => {
    expect(brlToUsdMicros(1, 0)).toBe(0);
  });

  it("usdToMicros rejects negative", () => {
    expect(usdToMicros(-1)).toBe(0);
  });
});
