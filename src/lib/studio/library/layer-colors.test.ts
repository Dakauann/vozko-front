import { describe, expect, it } from "vitest";

import { newTextLayer, type Layer } from "../document";
import { layerColors, recolorLayer } from "./placement";

function sticker(): Layer {
  return {
    ...newTextLayer("BOLD moves", "heading"),
    fill: undefined,
    fills: [
      { type: "solid", color: "#FFD60A", opacity: 1 },
      { type: "gradient", gradient: { from: "#ff006e", via: "#8338ec", to: "#3a86ff", angle: 90 }, opacity: 0.5 },
    ],
    strokes: [{ type: "solid", color: "#111111", opacity: 1, width: 8, align: "outside" }],
    effects: [{ id: "glow", type: "outer-glow", color: "#00f5d4", opacity: 0.8, x: 0, y: 0, blur: 12, spread: 0 }],
    runs: [{ start: 5, end: 10, fill: "#E63946" }],
  };
}

describe("library colors inside paint lists, effects and runs", () => {
  it("lists every color a sticker title paints with", () => {
    expect(layerColors([sticker()])).toEqual(["#ffd60a", "#ff006e", "#8338ec", "#3a86ff", "#111111", "#00f5d4", "#e63946"]);
  });

  it("swaps each of those colors and leaves the rest of the look alone", () => {
    const swapped = recolorLayer(sticker(), [
      { from: "#ffd60a", to: "#ffffff" },
      { from: "#8338ec", to: "#222222" },
      { from: "#111111", to: "#000000" },
      { from: "#00f5d4", to: "#ff0000" },
      { from: "#e63946", to: "#00ff00" },
    ]);
    expect(swapped.fills?.[0]).toEqual({ type: "solid", color: "#ffffff", opacity: 1 });
    expect(swapped.fills?.[1].gradient).toEqual({ from: "#ff006e", via: "#222222", to: "#3a86ff", angle: 90 });
    expect(swapped.strokes?.[0]).toEqual({ type: "solid", color: "#000000", opacity: 1, width: 8, align: "outside" });
    expect(swapped.effects?.[0].color).toBe("#ff0000");
    expect(swapped.runs).toEqual([{ start: 5, end: 10, fill: "#00ff00" }]);
    expect(swapped.fill).toBeUndefined();
  });
});
