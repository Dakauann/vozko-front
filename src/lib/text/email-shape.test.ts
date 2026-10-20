import { describe, expect, it } from "vitest";

import { looksLikeEmail } from "./email-shape";

describe("an email address shape", () => {
  it("accepts a plain address and trims around it", () => {
    expect(looksLikeEmail("ana@empresa.com.br")).toBe(true);
    expect(looksLikeEmail("  ana@empresa.com  ")).toBe(true);
  });

  it("refuses phone numbers, names and half addresses", () => {
    expect(looksLikeEmail("5511999990000")).toBe(false);
    expect(looksLikeEmail("Ana Souza")).toBe(false);
    expect(looksLikeEmail("ana@empresa")).toBe(false);
    expect(looksLikeEmail("ana @empresa.com")).toBe(false);
  });
});
