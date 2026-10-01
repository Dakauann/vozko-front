import { describe, expect, it } from "vitest";

import { estimateUsage } from "./plan-estimates";

const items = [
  { category: "whatsapp", service: "utility", metric: "per_message", priceMicros: 16_667 },
  { category: "whatsapp", service: "service", metric: "per_message", priceMicros: 0 },
  { category: "telephony", service: "whatsapp_calls", metric: "per_minute", priceMicros: 13_333 },
  { category: "telephony", service: "sip_calls", metric: "per_minute", priceMicros: 0 },
  { category: "llm", service: "default_markup", metric: "percentage", priceMicros: 0 },
];

describe("estimateUsage", () => {
  it("says how many messages and call minutes the plan price covers", () => {
    expect(estimateUsage(10_000, items, 6)).toEqual([
      { category: "telephony", service: "whatsapp_calls", unit: "minutes", count: 1250 },
      { category: "whatsapp", service: "utility", unit: "messages", count: 1000 },
    ]);
  });

  it("skips free services, AI markups and a missing exchange rate", () => {
    expect(estimateUsage(10_000, items.slice(1, 2), 6)).toEqual([]);
    expect(estimateUsage(10_000, items, 0)).toEqual([]);
  });
});
