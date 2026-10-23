import { describe, expect, it } from "vitest";

import { showsReady } from "./ready";

describe("showsReady", () => {
  it("shows a never started campaign as ready, as the server says", () => {
    expect(showsReady({ status: "STOPPED", readyToStart: true })).toBe(true);
  });

  it("keeps every other campaign on its own status", () => {
    expect(showsReady({ status: "STOPPED", readyToStart: false })).toBe(false);
    expect(showsReady({ status: "STOPPED" })).toBe(false);
    expect(showsReady({ status: "RUNNING", readyToStart: true })).toBe(false);
  });

  it("follows the live status over the stored one", () => {
    expect(showsReady({ status: "STOPPED", readyToStart: true }, "RUNNING")).toBe(false);
  });
});
