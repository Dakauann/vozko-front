import { afterEach, describe, expect, it, vi } from "vitest";

import { browserStorage } from "./browser-storage";

describe("browserStorage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("reads back what it wrote", () => {
    browserStorage.write("vozko.test.key", "1");
    expect(browserStorage.read("vozko.test.key")).toBe("1");
  });

  it("reads nothing when the browser refuses storage, so a private window still renders", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(browserStorage.read("vozko.test.key")).toBeNull();
  });

  it("drops a write the browser refuses instead of throwing into the caller", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => browserStorage.write("vozko.test.key", "1")).not.toThrow();
  });
});
