import { describe, expect, it } from "vitest";

import { iconDataUrl, iconSvgMarkup, STUDIO_ICON_IDS } from "./icon-catalog";

describe("studio icon catalog", () => {
  it("uses ids the backend accepts as icon tokens", () => {
    expect(STUDIO_ICON_IDS.length).toBeGreaterThan(20);
    for (const id of STUDIO_ICON_IDS) expect(id).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
  });

  it("renders a self-contained SVG in the layer color and size", () => {
    for (const id of STUDIO_ICON_IDS) {
      const markup = iconSvgMarkup(id, "#ff0000", 200, 100)!;
      expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(markup).toContain('width="200" height="100"');
      expect(markup).not.toMatch(/currentColor|var\(/);
    }
    expect(iconSvgMarkup("star", "#ff0000", 10, 10)).toContain("#ff0000");
  });

  it("refuses unknown icons instead of drawing a stand-in", () => {
    expect(iconSvgMarkup("nope", "#000000", 10, 10)).toBeNull();
    expect(iconDataUrl("nope", "#000000", 10, 10)).toBeNull();
    expect(iconDataUrl("star", "#000000", 10, 10)).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });
});
