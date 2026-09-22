
import { describe, expect, it } from "vitest";

import { apiClient, refreshSession } from "@/lib/api/browser-client";

describe("browser-client SSR guard", () => {
  it("apiClient rejects when called on the server (no window)", async () => {
    await expect(apiClient("/anything")).rejects.toThrow(/browser-only/i);
  });

  it("refreshSession throws when called on the server (no window)", () => {
    expect(() => refreshSession()).toThrow(/browser-only/i);
  });
});
