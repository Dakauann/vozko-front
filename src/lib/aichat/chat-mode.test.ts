import { describe, expect, it } from "vitest";

import { DEFAULT_STUDIO_MODE, parseStoredMode, readStudioMode, STUDIO_MODE_KEY, writeStudioMode } from "./chat-mode";

describe("studio execution mode preference", () => {
  it("starts in full access, as the person asked for the studio", () => {
    expect(DEFAULT_STUDIO_MODE).toBe("full");
    expect(parseStoredMode(null)).toBe("full");
  });

  it("keeps only a known mode", () => {
    expect(parseStoredMode("ask")).toBe("ask");
    expect(parseStoredMode("yolo")).toBe("full");
  });

  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readStudioMode(broken)).toBe("full");
    expect(() => writeStudioMode(broken, "ask")).not.toThrow();
  });

  it("round trips through storage", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    writeStudioMode(storage, "edit");
    expect(data.get(STUDIO_MODE_KEY)).toBe("edit");
    expect(readStudioMode(storage)).toBe("edit");
  });
});
