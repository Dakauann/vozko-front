import { describe, expect, it } from "vitest";

import { formatThreadCost, formatTokenCount, threadCostKey, threadUsage } from "./thread-cost";

const nbsp = (s: string) => s.replace(/ /g, " ");

describe("formatThreadCost", () => {
  it("shows what was charged in the billing currency, short", () => {
    expect(nbsp(formatThreadCost({ available: true, amountMicros: 420_000, currency: "BRL" }, "pt") ?? "")).toBe("R$ 0,42");
    expect(nbsp(formatThreadCost({ available: true, amountMicros: 12_345_678, currency: "BRL" }, "pt") ?? "")).toBe("R$ 12,35");
    expect(formatThreadCost({ available: true, amountMicros: 420_000, currency: "BRL" }, "en")).toBe("R$0.42");
  });

  it("shows zero for a session that has not been charged yet", () => {
    expect(nbsp(formatThreadCost({ available: true, amountMicros: 0, currency: "BRL" }, "pt") ?? "")).toBe("R$ 0,00");
  });

  it("never rounds a real charge down to zero", () => {
    expect(nbsp(formatThreadCost({ available: true, amountMicros: 3_000, currency: "BRL" }, "pt") ?? "")).toBe("< R$ 0,01");
  });

  it("has no figure when the total cannot be exact", () => {
    expect(formatThreadCost(null, "pt")).toBeNull();
    expect(formatThreadCost({ available: false, amountMicros: 0, currency: "BRL" }, "pt")).toBeNull();
    expect(formatThreadCost({ available: true, amountMicros: -10, currency: "BRL" }, "pt")).toBeNull();
    expect(formatThreadCost({ available: true, amountMicros: Number.NaN, currency: "BRL" }, "pt")).toBeNull();
    expect(formatThreadCost({ available: true, amountMicros: 420_000, currency: "XYZ" }, "pt")).toBeNull();
  });
});

describe("threadCostKey", () => {
  it("changes when the thread or its finished answers change", () => {
    expect(threadCostKey("th-1", 0)).not.toBe(threadCostKey("th-1", 1));
    expect(threadCostKey("th-1", 0)).not.toBe(threadCostKey("th-2", 0));
    expect(threadCostKey(null, 3)).toBeNull();
  });
});

const usage = { available: true, calls: 15, inputTokens: 960_532, outputTokens: 19_172, cacheReadTokens: 820_000, cacheWriteTokens: 95_000, reasoningTokens: 3_100 };

describe("formatTokenCount", () => {
  it("writes token counts short, in the reader's language", () => {
    expect(nbsp(formatTokenCount(979_704, "pt"))).toBe("979,7 mil");
    expect(formatTokenCount(979_704, "en")).toBe("979.7K");
    expect(formatTokenCount(1_250_000, "en")).toBe("1.3M");
    expect(formatTokenCount(812, "pt")).toBe("812");
  });
});

describe("threadUsage", () => {
  it("gives the token figures only when they are exact", () => {
    expect(threadUsage({ available: true, amountMicros: 1, currency: "BRL", usage })).toEqual({ ...usage, totalTokens: 979_704 });
    expect(threadUsage({ available: true, amountMicros: 1, currency: "BRL", usage: { ...usage, available: false } })).toBeNull();
    expect(threadUsage({ available: true, amountMicros: 1, currency: "BRL" })).toBeNull();
    expect(threadUsage(null)).toBeNull();
  });
});
