import { describe, expect, it } from "vitest";

import {
  basisPointsToPercent,
  decideAt,
  formatBasisPoints,
  formatBrl,
  formatBrlMicros,
  formatUnitBrl,
  hasTimelineActivity,
  linkLabel,
  remainingSeconds,
  share,
  splitDuration,
  timelineFormatters,
} from "../format";

describe("rates", () => {
  it("turns basis points into percent", () => {
    expect(basisPointsToPercent(1234)).toBe(12.34);
  });

  it("formats rates in the locale", () => {
    expect(formatBasisPoints(1234, "pt-BR")).toBe("12,3%");
    expect(formatBasisPoints(1234, "en-US")).toBe("12.3%");
  });

  it("computes a bounded share", () => {
    expect(share(25, 100)).toBe(25);
    expect(share(5, 0)).toBe(0);
    expect(share(-1, 10)).toBe(0);
    expect(share(30, 10)).toBe(100);
  });
});

describe("money", () => {
  it("converts usd micros to brl with the exchange rate", () => {
    expect(formatBrlMicros(1_000_000, 5, "pt-BR")?.replace(/\s/g, " ")).toBe("R$ 5,00");
  });

  it("stays unknown without an exchange rate", () => {
    expect(formatBrlMicros(1_000_000, null, "pt-BR")).toBeNull();
  });

  it("formats zero instead of hiding it", () => {
    expect(formatBrlMicros(0, 5, "en-US")).toBe("R$0.00");
  });
});

describe("formatBrl", () => {
  it("formats reais the backend already converted", () => {
    expect(formatBrl(2.97, "pt-BR")?.replace(/\s/g, " ")).toBe("R$ 2,97");
    expect(formatBrl(0.0035, "pt-BR", 4)?.replace(/\s/g, " ")).toBe("R$ 0,0035");
  });

  it("stays unknown when the backend could not read the exchange rate", () => {
    expect(formatBrl(null, "pt-BR")).toBeNull();
  });

  it("never shows a non zero total as zero", () => {
    expect(formatBrl(0.0035, "pt-BR")?.replace(/\s/g, " ")).toBe("R$ 0,0035");
    expect(formatBrlMicros(700, 5, "pt-BR")?.replace(/\s/g, " ")).toBe("R$ 0,0035");
    expect(formatBrl(0, "pt-BR")?.replace(/\s/g, " ")).toBe("R$ 0,00");
  });

  it("shows a balance apart from the one it is compared to", () => {
    expect(formatBrl(499.9965, "pt-BR", 2, 500)?.replace(/\s/g, " ")).toBe("R$ 499,9965");
    expect(formatBrl(497.03, "pt-BR", 2, 500)?.replace(/\s/g, " ")).toBe("R$ 497,03");
  });
});

describe("formatUnitBrl", () => {
  it("keeps the fraction a single email costs", () => {
    expect(formatUnitBrl(0.0035, "pt-BR")?.replace(/\s/g, " ")).toBe("R$ 0,0035");
  });

  it("drops padding zeros on round unit prices", () => {
    expect(formatUnitBrl(0.08, "pt-BR")?.replace(/\s/g, " ")).toBe("R$ 0,08");
    expect(formatUnitBrl(0.4, "pt-BR")?.replace(/\s/g, " ")).toBe("R$ 0,40");
  });

  it("stays unknown without a converted value", () => {
    expect(formatUnitBrl(undefined, "pt-BR")).toBeNull();
  });
});

describe("timeline", () => {
  it("detects activity", () => {
    expect(hasTimelineActivity([{ sent: 0, delivered: 0, opens: 0, clicks: 0, bounces: 0 }])).toBe(false);
    expect(hasTimelineActivity([{ sent: 0, delivered: 0, opens: 1, clicks: 0, bounces: 0 }])).toBe(true);
  });

  it("formats ticks per bucket in a time zone", () => {
    const hourly = timelineFormatters("hour", "pt-BR", "UTC");
    const daily = timelineFormatters("day", "pt-BR", "UTC");
    expect(hourly.tick("2026-10-21T14:00:00Z")).toContain("14:00");
    expect(daily.tick("2026-10-21T14:00:00Z")).toBe("21/10");
  });
});

describe("a/b countdown", () => {
  it("adds the decision window to the start", () => {
    expect(decideAt("2026-10-21T10:00:00Z", 120)?.toISOString()).toBe("2026-10-21T12:00:00.000Z");
    expect(decideAt(undefined, 120)).toBeNull();
  });

  it("counts down to zero and splits the duration", () => {
    const target = new Date("2026-10-21T12:00:00Z");
    expect(remainingSeconds(target, new Date("2026-10-21T11:00:00Z").getTime())).toBe(3600);
    expect(remainingSeconds(target, new Date("2026-10-21T13:00:00Z").getTime())).toBe(0);
    expect(splitDuration(3725)).toEqual({ hours: 1, minutes: 2, seconds: 5 });
  });
});

describe("linkLabel", () => {
  it("splits host and path and hides tracking parameters", () => {
    expect(linkLabel("https://loja.com/oferta?utm_source=email&utm_medium=email&id=7")).toEqual({ host: "loja.com", path: "/oferta?id=7" });
    expect(linkLabel("https://loja.com/")).toEqual({ host: "loja.com", path: "" });
  });

  it("keeps anything it cannot parse", () => {
    expect(linkLabel("mailto:ana@loja.com").host).toBe("");
    expect(linkLabel("not a url")).toEqual({ host: "not a url", path: "" });
  });
});
