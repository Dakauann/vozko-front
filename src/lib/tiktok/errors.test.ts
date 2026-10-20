import { describe, expect, it } from "vitest";

import { TIKTOK_ERROR_CODES, tiktokErrorKey } from "@/lib/tiktok/errors";

describe("tiktokErrorKey", () => {
  it("names a copy key for every status the TikTok endpoints answer with", () => {
    expect(tiktokErrorKey(404)).toBe("errors.not_found");
    expect(tiktokErrorKey(409)).toBe("errors.unavailable");
    expect(tiktokErrorKey(422)).toBe("errors.invalid");
    expect(tiktokErrorKey(429)).toBe("errors.rate_limited");
    expect(tiktokErrorKey(502)).toBe("errors.tiktok_failed");
  });

  it("lists every code it can produce", () => {
    expect([...TIKTOK_ERROR_CODES].sort()).toEqual(["invalid", "not_found", "rate_limited", "tiktok_failed", "unavailable"]);
  });

  it("falls back to the generic copy for anything else", () => {
    expect(tiktokErrorKey(undefined)).toBe("errors.generic");
    expect(tiktokErrorKey(500)).toBe("errors.generic");
    expect(tiktokErrorKey(400)).toBe("errors.generic");
  });
});
