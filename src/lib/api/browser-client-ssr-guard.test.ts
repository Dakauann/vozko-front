/**
 * @vitest-environment node
 *
 * The single-flight refresh state in browser-client is per-browser and MUST NOT
 * run on the shared server process (that was the historic cross-user session
 * leak). This pins the guard: calling apiClient/refreshSession with no `window`
 * (i.e. during SSR/render) throws instead of silently sharing state.
 */

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
