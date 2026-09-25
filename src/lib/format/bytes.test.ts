import { describe, expect, it } from "vitest";

import { formatBytes, megabytesToBytes } from "./bytes";

describe("formatBytes", () => {
  it("picks the unit that keeps the number readable", () => {
    expect(formatBytes(0, "en")).toBe("0 B");
    expect(formatBytes(512, "en")).toBe("512 B");
    expect(formatBytes(40 * 1024, "en")).toBe("40 KB");
    expect(formatBytes(1.5 * 1024 * 1024, "en")).toBe("1.5 MB");
    expect(formatBytes(3 * 1024 ** 3, "en")).toBe("3 GB");
  });

  it("uses the locale's decimal separator", () => {
    expect(formatBytes(1.5 * 1024 * 1024, "pt")).toBe("1,5 MB");
  });
});

describe("megabytesToBytes", () => {
  it("converts the stored megabytes back to bytes", () => {
    expect(megabytesToBytes(0.5)).toBe(512 * 1024);
    expect(megabytesToBytes(undefined)).toBe(0);
  });
});
