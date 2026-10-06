import { describe, expect, it } from "vitest";

import { newIconLayer, newImageLayer, newShapeLayer, newTextLayer } from "./document";
import { styleActionFor, styleOf, stylePatch } from "./style";

describe("copy and paste style", () => {
  it("copies text styling onto another text, clearing effects the source lacks", () => {
    const source = { ...newTextLayer("A", "heading"), fill: "#ff0000", fontId: "oswald" as const, transform: { ...newTextLayer("A").transform, opacity: 0.5 } };
    const target = { ...newTextLayer("B"), shadow: { color: "#000000", blur: 4, x: 0, y: 2 }, text: "keep me" };
    const patch = stylePatch(styleOf(source), target);
    expect(patch).toMatchObject({ fill: "#ff0000", fontId: "oswald", fontSize: source.fontSize, shadow: undefined });
    expect("text" in patch).toBe(false);
    expect(patch.transform).toEqual({ ...target.transform, opacity: 0.5 });
  });

  it("only carries what the target kind understands", () => {
    const text = { ...newTextLayer("A"), fill: "#00ff00", blendMode: "multiply" as const };
    const patch = stylePatch(styleOf(text), newShapeLayer("rect"));
    expect(patch).toMatchObject({ fill: "#00ff00", blendMode: "multiply" });
    expect("fontId" in patch).toBe(false);
    const image = { ...newImageLayer("m"), filters: { brightness: 0.2, contrast: 0, saturation: 0, blur: 0 } };
    expect(stylePatch(styleOf(image), newIconLayer("star"))).not.toHaveProperty("filters");
    expect(stylePatch(styleOf(image), newImageLayer("n"))).toMatchObject({ filters: image.filters });
  });
});

describe("styleActionFor", () => {
  const key = (k: string, code: string, extra: object = {}) => ({ key: k, code, ctrlKey: true, metaKey: false, shiftKey: false, altKey: true, ...extra });
  it("maps Ctrl+Alt+C and Ctrl+Alt+V outside text fields", () => {
    expect(styleActionFor(key("c", "KeyC"))).toEqual({ type: "copyStyle" });
    expect(styleActionFor(key("v", "KeyV"))).toEqual({ type: "pasteStyle" });
    expect(styleActionFor(key("c", "KeyC", { altKey: false }))).toBeNull();
    expect(styleActionFor(key("v", "KeyV", { target: document.createElement("textarea") }))).toBeNull();
  });
});
