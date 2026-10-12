import { describe, expect, it, vi } from "vitest";

import { localStore, parseStoredSize, readStoredSize, writeStoredSize } from "./stored-size";

describe("parseStoredSize", () => {
  it("accepts positive numbers only", () => {
    expect(parseStoredSize("520")).toBe(520);
    expect(parseStoredSize("92.5")).toBe(92.5);
    expect(parseStoredSize(null)).toBeNull();
    expect(parseStoredSize("")).toBeNull();
    expect(parseStoredSize("abc")).toBeNull();
    expect(parseStoredSize("-3")).toBeNull();
    expect(parseStoredSize("0")).toBeNull();
    expect(parseStoredSize('{"width":480,"height":720}')).toBeNull();
  });
});

describe("stored sizes", () => {
  it("reads back what was written", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) };
    writeStoredSize(storage, "box", 140);
    expect(readStoredSize(storage, "box")).toBe(140);
    expect(readStoredSize(storage, "other")).toBeNull();
  });

  it("treats a missing or failing storage as nothing remembered", () => {
    const failing = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("quota");
      }),
    };
    expect(readStoredSize(failing, "box")).toBeNull();
    expect(() => writeStoredSize(failing, "box", 140)).not.toThrow();
    expect(readStoredSize(null, "box")).toBeNull();
    expect(() => writeStoredSize(null, "box", 140)).not.toThrow();
  });

  it("finds no store when the browser refuses access", () => {
    const access = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(localStore()).toBeNull();
    access.mockRestore();
    expect(localStore()).toBe(window.localStorage);
  });
});
