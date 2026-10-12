import { describe, expect, it } from "vitest";

import { decodeClipboard, encodeClipboard } from "./clipboard";
import type { Layer } from "./document";
import type { StudioStyle } from "./shared-styles";

const red: StudioStyle = { id: "red", kind: "color", name: "Vermelho", color: "#e4003a" };
const heading: StudioStyle = { id: "h1", kind: "text", name: "Título", fontSizePx: 72 };
const title: Layer = { id: "title", type: "text", text: "Oferta", fontId: "inter", fontSize: 72 / 1080, fill: "#e4003a", transform: { x: 0.5, y: 0.5, w: 0.5, h: 0.2, rotation: 0, opacity: 1 }, fillStyleId: "red", textStyleId: "h1" };

describe("copying linked layers", () => {
  it("keeps the links and carries the style definitions", () => {
    const decoded = decodeClipboard(encodeClipboard({ layers: [title], groups: [], styles: [red, heading] }));
    expect(decoded?.layers[0]).toMatchObject({ fillStyleId: "red", textStyleId: "h1" });
    expect(decoded?.styles).toEqual([red, heading]);
  });

  it("refuses broken style definitions and drops link ids that are not tokens", () => {
    expect(decodeClipboard(encodeClipboard({ layers: [title], groups: [], styles: [{ ...red, color: "vermelho" }] }))).toBeNull();
    const decoded = decodeClipboard(encodeClipboard({ layers: [{ ...title, fillStyleId: "not a token" }], groups: [] }));
    expect(decoded?.layers[0].fillStyleId).toBeUndefined();
    expect(decoded?.layers[0].textStyleId).toBe("h1");
  });
});
