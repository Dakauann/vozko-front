import { beforeEach, describe, expect, it, vi } from "vitest";

import { BaseStyleError, forgetBaseStyles, loadBaseStyle } from "./style-loader";

const style = { version: 8, sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } }, layers: [] };

const answer = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 503, json: () => Promise.resolve(body) });

describe("loadBaseStyle", () => {
  beforeEach(() => {
    forgetBaseStyles();
  });

  it("loads the style JSON once per URL", async () => {
    const fetcher = answer(style);
    const first = await loadBaseStyle("https://tiles.example.com/a", fetcher);
    const second = await loadBaseStyle("https://tiles.example.com/a", fetcher);
    expect(first).toEqual(style);
    expect(second).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refuses a body that is not a version 8 style", async () => {
    await expect(loadBaseStyle("https://tiles.example.com/b", answer({ version: 7, layers: [] }))).rejects.toBeInstanceOf(BaseStyleError);
    await expect(loadBaseStyle("https://tiles.example.com/c", answer({ version: 8, sources: {}, layers: {} }))).rejects.toBeInstanceOf(BaseStyleError);
  });

  it("refuses an error answer", async () => {
    await expect(loadBaseStyle("https://tiles.example.com/d", answer(style, false))).rejects.toBeInstanceOf(BaseStyleError);
  });

  it("tries again after a failure instead of caching it", async () => {
    const failing = vi.fn().mockRejectedValue(new TypeError("network"));
    await expect(loadBaseStyle("https://tiles.example.com/e", failing)).rejects.toBeInstanceOf(BaseStyleError);
    const working = answer(style);
    await expect(loadBaseStyle("https://tiles.example.com/e", working)).resolves.toEqual(style);
  });
});
