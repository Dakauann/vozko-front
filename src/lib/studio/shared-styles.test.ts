import { describe, expect, it } from "vitest";

import { imageDocument, type Artboard, type ImageDocument, type Layer } from "./document";
import { linkedSlots, settleStyles, slotIssue, slotSuits, styleSummary, styleValues, type StudioStyle } from "./shared-styles";

const red: StudioStyle = { id: "red", kind: "color", name: "Marca/Vermelho", color: "#e4003a" };
const sunset: StudioStyle = { id: "sunset", kind: "color", name: "Pôr do sol", gradient: { from: "#ff7a00", to: "#e4003a", angle: 90, kind: "linear" } };
const heading: StudioStyle = { id: "h1", kind: "text", name: "Título", role: "heading", fontId: "montserrat", fontWeight: 800, fontSizePx: 72, lineHeight: 1.05 };
const brandFont: StudioStyle = { id: "font", kind: "text", name: "Fonte da marca", fontId: "montserrat" };
const soft: StudioStyle = { id: "soft", kind: "effect", name: "Sombra suave", shadow: { color: "#00000059", blur: 24, x: 0, y: 8 } };

const box = { x: 0.5, y: 0.5, w: 0.5, h: 0.2, rotation: 0, opacity: 1 };
const title: Layer = { id: "title", type: "text", text: "Oferta", fontId: "montserrat", fontWeight: 800, fontSize: 72 / 1080, lineHeight: 1.05, fill: "#E4003A", transform: box, fillStyleId: "red", textStyleId: "h1" };
const card: Layer = { id: "card", type: "shape", shape: "rect", fill: "#ff7a00", gradient: sunset.gradient, stroke: "#e4003a", strokeWidth: 4, shadow: soft.shadow, transform: box, fillStyleId: "sunset", strokeStyleId: "red", effectStyleId: "soft" };

function doc(layers: Layer[], styles: StudioStyle[] = [red, sunset, heading, brandFont, soft]): ImageDocument {
  const board: Artboard = { id: "feed", x: 0, y: 0, canvas: { width: 1080, height: 1080, background: "#e4003a", backgroundStyleId: "red" }, layers };
  return { ...imageDocument([board]), styles };
}

describe("style values", () => {
  it("write the slot fields, with pixel font sizes turned into the surface fraction", () => {
    expect(styleValues(red, "fill", 1080)).toEqual({ fill: "#e4003a", gradient: undefined });
    expect(styleValues(sunset, "fill", 1080)).toEqual({ fill: "#ff7a00", gradient: sunset.gradient });
    expect(styleValues(red, "stroke", 1080)).toEqual({ stroke: "#e4003a" });
    expect(styleValues(heading, "text", 1920)).toEqual({ fontId: "montserrat", fontWeight: 800, fontSize: 72 / 1920, lineHeight: 1.05 });
    expect(styleValues(brandFont, "text", 1080)).toEqual({ fontId: "montserrat" });
    expect(styleValues(soft, "effect", 1080)).toEqual({ shadow: soft.shadow });
  });
});

describe("slots", () => {
  it("suit only the layers that paint them", () => {
    expect(slotSuits(title, "fill", red)).toBe(true);
    expect(slotSuits(title, "stroke", red)).toBe(false);
    expect(slotSuits(card, "stroke", sunset)).toBe(false);
    expect(slotSuits({ ...card, type: "icon", iconId: "star", gradient: undefined }, "fill", sunset)).toBe(false);
    expect(slotSuits({ ...card, shape: "line" }, "fill", red)).toBe(false);
    expect(slotSuits(card, "text", heading)).toBe(false);
    expect(slotSuits({ ...card, effects: [{ id: "e", type: "drop-shadow", color: "#000000", opacity: 1, x: 0, y: 4, blur: 8, spread: 0 }] }, "effect", soft)).toBe(false);
    expect(slotSuits({ ...title, fills: [{ type: "solid", color: "#000000", opacity: 1 }] }, "fill", red)).toBe(false);
    expect(slotSuits(title, "fill", heading)).toBe(false);
  });

  it("hold while every governed value matches the style", () => {
    expect(slotIssue(title, "fill", red, 1080)).toBeNull();
    expect(slotIssue(title, "text", heading, 1080)).toBeNull();
    expect(slotIssue({ ...title, fontSize: 72.005 / 1080 }, "text", heading, 1080)).toBeNull();
    expect(slotIssue({ ...title, fontSize: 73 / 1080 }, "text", heading, 1080)).toBe("invalid");
    expect(slotIssue({ ...title, fontWeight: 700 }, "text", heading, 1080)).toBe("invalid");
    expect(slotIssue(title, "text", heading, 1920)).toBe("invalid");
    expect(slotIssue(card, "fill", sunset, 1080)).toBeNull();
    expect(slotIssue({ ...card, gradient: { ...sunset.gradient!, angle: 45 } }, "fill", sunset, 1080)).toBe("invalid");
    expect(slotIssue({ ...title, gradient: sunset.gradient }, "fill", red, 1080)).toBe("invalid");
    expect(slotIssue(card, "effect", soft, 1080)).toBeNull();
    expect(slotIssue({ ...card, shadow: { ...soft.shadow!, blur: 10 } }, "effect", soft, 1080)).toBe("invalid");
  });

  it("list the links of a layer", () => {
    expect(linkedSlots(card)).toEqual([
      ["fill", "sunset"],
      ["stroke", "red"],
      ["effect", "soft"],
    ]);
  });
});

describe("settling styles", () => {
  it("keeps consistent links and the same document", () => {
    const d = doc([title, card]);
    const edited = { ...d, artboards: [{ ...d.artboards[0], layers: [title, { ...card, transform: { ...box, x: 0.2 } }] }] };
    expect(settleStyles(d, edited)).toBe(edited);
  });

  it("detaches the slots whose values changed and keeps every value", () => {
    const d = doc([title, card]);
    const edited = { ...d, artboards: [{ ...d.artboards[0], canvas: { ...d.artboards[0].canvas, background: "#000000" }, layers: [{ ...title, fill: "#00ff00", fontSize: 0.05 }, card] }] };
    const settled = settleStyles(d, edited);
    const [layer] = settled.artboards[0].layers;
    expect(layer.fill).toBe("#00ff00");
    expect(layer.fillStyleId).toBeUndefined();
    expect(layer.textStyleId).toBeUndefined();
    expect(settled.artboards[0].canvas.backgroundStyleId).toBeUndefined();
    expect(settled.artboards[0].layers[1]).toBe(card);
  });

  it("drops links to styles that no longer exist", () => {
    const d = doc([title]);
    const settled = settleStyles(d, { ...d, styles: [heading] });
    expect(settled.artboards[0].layers[0].fillStyleId).toBeUndefined();
    expect(settled.artboards[0].layers[0].textStyleId).toBe("h1");
  });
});

describe("style summaries", () => {
  it("read compactly", () => {
    expect(styleSummary(red)).toBe("#e4003a");
    expect(styleSummary(sunset)).toBe("linear #ff7a00 to #e4003a 90°");
    expect(styleSummary(heading)).toBe("montserrat 800 72px/1.05");
    expect(styleSummary(soft)).toBe("shadow 0 8 24 #00000059");
  });
});
