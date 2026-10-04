import { describe, expect, it } from "vitest";

import { formatWhen } from "./when";

describe("formatWhen", () => {
  it("formats a timestamp in the viewer's locale", () => {
    expect(formatWhen("2026-10-02T12:00:00Z", "pt-BR", false)).toBe("02/10/2026");
  });

  it("shows the empty mark for missing, broken or zero dates", () => {
    expect(formatWhen(undefined, "pt-BR")).toBe("n/d");
    expect(formatWhen("nope", "pt-BR")).toBe("n/d");
    expect(formatWhen("0001-01-01T00:00:00Z", "pt-BR")).toBe("n/d");
  });
});
