import { describe, expect, it } from "vitest";

import { DEFAULT_MAP_STYLE_URL, resolveMapStyleUrl } from "./config";

describe("resolveMapStyleUrl", () => {
  it("defaults to the OpenFreeMap Positron style", () => {
    expect(DEFAULT_MAP_STYLE_URL).toBe("https://tiles.openfreemap.org/styles/positron");
    expect(resolveMapStyleUrl(undefined)).toEqual({ ok: true, url: DEFAULT_MAP_STYLE_URL });
  });

  it("treats a blank value as unset", () => {
    expect(resolveMapStyleUrl("   ")).toEqual({ ok: true, url: DEFAULT_MAP_STYLE_URL });
  });

  it("uses the configured style, trimmed", () => {
    expect(resolveMapStyleUrl(" https://cdn.example.com/basemap/style.json ")).toEqual({
      ok: true,
      url: "https://cdn.example.com/basemap/style.json",
    });
  });

  it("accepts a style served by this site", () => {
    expect(resolveMapStyleUrl("/map/style.json")).toEqual({ ok: true, url: "/map/style.json" });
  });

  it("refuses a style that is not served over https instead of quietly using the public one", () => {
    expect(resolveMapStyleUrl("http://tiles.example.com/style.json")).toEqual({ ok: false, reason: "not_https" });
  });

  it.each(["not a url", "//cdn.example.com/style.json", "map/style.json", "ftp://tiles.example.com/style.json"])(
    "refuses %j as a configuration error",
    (value) => {
      expect(resolveMapStyleUrl(value).ok).toBe(false);
    },
  );
});
