import { describe, expect, it } from "vitest";

import {
  SectionError,
  isBusySectionError,
  requireSectionData,
  sectionErrorCode,
  shouldRetrySection,
} from "@/lib/analytics/section-query";

describe("requireSectionData", () => {
  it("returns the section payload", () => {
    expect(requireSectionData({ data: { total: 3 } }, "lead section summary")).toEqual({ total: 3 });
  });

  it("keeps the server status on a refused section", () => {
    let failure: unknown;
    try {
      requireSectionData({ error: { message: "busy", status: 503 } }, "lead section summary");
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(SectionError);
    expect((failure as SectionError).status).toBe(503);
    expect((failure as SectionError).message).toBe("busy");
  });

  it("refuses a section that came back empty", () => {
    expect(() => requireSectionData({}, "lead section summary")).toThrow("lead section summary came back empty");
  });
});

describe("section error codes", () => {
  it("keeps the server code on a refused section", () => {
    let failure: unknown;
    try {
      requireSectionData({ error: { message: "off", status: 503, code: "lead_map_unavailable" } }, "lead map viewport");
    } catch (error) {
      failure = error;
    }
    expect((failure as SectionError).code).toBe("lead_map_unavailable");
    expect(sectionErrorCode(failure)).toBe("lead_map_unavailable");
  });

  it("has no code for anything that is not a section error", () => {
    expect(sectionErrorCode(new Error("boom"))).toBeUndefined();
    expect(sectionErrorCode(null)).toBeUndefined();
  });

  it("retries a busy answer, which carries no code", () => {
    expect(shouldRetrySection(0, new SectionError("busy", 503))).toBe(true);
    expect(isBusySectionError(new SectionError("busy", 503))).toBe(true);
  });

  it("does not retry a 503 that names why the service is off", () => {
    const off = new SectionError("off", 503, "lead_map_unavailable");
    expect(shouldRetrySection(0, off)).toBe(false);
    expect(isBusySectionError(off)).toBe(false);
  });
});
