import { describe, expect, it } from "vitest";

import { newTextLayer, type Layer } from "./document";
import { codePointIndex, fontPatch, styleRange, toggledPatch, utf16Index, wholeTextField, wholeTextLayerPatch } from "./text-run-editing";
import { counterTemplateRange, sameRuns } from "./text-runs";

function text(value: string, extra: Partial<Layer> = {}): Layer {
  return { ...newTextLayer(value), fontId: "inter", fontWeight: 400, fill: "#111111", fontSize: 0.1, ...extra };
}

describe("code point offsets", () => {
  it("counts an emoji as one character in both directions", () => {
    const value = "a😀b";
    expect(codePointIndex(value, 0)).toBe(0);
    expect(codePointIndex(value, 3)).toBe(2);
    expect(codePointIndex(value, 4)).toBe(3);
    expect(utf16Index(value, 2)).toBe(3);
    expect(utf16Index(value, 3)).toBe(4);
  });

  it("rounds a point inside a surrogate pair past the emoji", () => {
    expect(codePointIndex("a😀b", 2)).toBe(2);
  });

  it("clamps offsets past the end", () => {
    expect(codePointIndex("ab", 9)).toBe(2);
    expect(utf16Index("ab", 9)).toBe(2);
  });
});

describe("styleRange", () => {
  it("treats a caret or the whole text as the whole text", () => {
    expect(styleRange({ start: 2, end: 2 }, 5)).toBeNull();
    expect(styleRange({ start: 0, end: 5 }, 5)).toBeNull();
    expect(styleRange(null, 5)).toBeNull();
  });

  it("keeps a partial selection and orders its ends", () => {
    expect(styleRange({ start: 4, end: 1 }, 5)).toEqual({ start: 1, end: 4 });
  });
});

describe("toggledPatch", () => {
  it("makes a selection bold and back to regular", () => {
    const layer = text("Compre agora");
    expect(toggledPatch(layer, { start: 7, end: 12 }, "bold")).toEqual({ fontWeight: 700 });
    const bold = { ...layer, runs: [{ start: 7, end: 12, fontWeight: 700 }] };
    expect(toggledPatch(bold, { start: 7, end: 12 }, "bold")).toEqual({ fontWeight: 400 });
  });

  it("turns a mixed selection bold", () => {
    const layer = { ...text("Compre agora"), runs: [{ start: 7, end: 12, fontWeight: 700 }] };
    expect(toggledPatch(layer, { start: 0, end: 12 }, "bold")).toEqual({ fontWeight: 700 });
  });

  it("toggles italic and underline", () => {
    const layer = text("Oi");
    expect(toggledPatch(layer, null, "italic")).toEqual({ italic: true });
    expect(toggledPatch({ ...layer, italic: true }, null, "italic")).toEqual({ italic: false });
    expect(toggledPatch(layer, { start: 0, end: 1 }, "underline")).toEqual({ underline: true });
  });

  it("refuses italic on a font without italics", () => {
    expect(toggledPatch(text("Oi", { fontId: "bebas-neue" }), null, "italic")).toBeNull();
  });
});

describe("fontPatch", () => {
  it("keeps the nearest weight of the new font", () => {
    const layer = text("Oi", { fontWeight: 700 });
    expect(fontPatch(layer, null, "bebas-neue")).toMatchObject({ fontId: "bebas-neue", fontWeight: 400 });
  });

  it("drops italic when the new font has none", () => {
    const layer = text("Oi", { italic: true });
    expect(fontPatch(layer, null, "bebas-neue")).toMatchObject({ italic: false });
  });
});

describe("whole text edits from the inspector", () => {
  it("leaves a layer without runs untouched", () => {
    const layer = text("Oi");
    expect(wholeTextLayerPatch(layer, { fontSize: 0.2 })).toEqual({ fontSize: 0.2 });
    expect(wholeTextField(layer, "fontSize", (l) => (l.fontSize ?? 0) * 100)).toBe(10);
  });

  it("removes the run overrides of the changed field", () => {
    const layer = { ...text("Compre agora"), runs: [{ start: 7, end: 12, fontWeight: 700, fill: "#ff0000" }] };
    expect(wholeTextLayerPatch(layer, { fontWeight: 300 })).toEqual({ fontWeight: 300, runs: [{ start: 7, end: 12, fill: "#ff0000" }] });
  });

  it("keeps fields that are not run styles", () => {
    const layer = { ...text("Oi"), italic: true, runs: [{ start: 0, end: 1, fill: "#ff0000" }] };
    expect(wholeTextLayerPatch(layer, { fontId: "inter", italic: undefined })).toEqual({ fontId: "inter", italic: undefined, runs: [{ start: 0, end: 1, fill: "#ff0000" }] });
  });

  it("reads null when the runs mix the field and the plain value otherwise", () => {
    const layer = { ...text("Compre agora"), runs: [{ start: 7, end: 12, fontWeight: 700 }] };
    expect(wholeTextField(layer, "fontWeight", (l) => l.fontWeight)).toBeNull();
    expect(wholeTextField(layer, "fill", (l) => l.fill ?? "#000000")).toBe("#111111");
  });
});

describe("counterTemplateRange", () => {
  const counter = { prefix: "R$ ", suffix: " mil" };
  const number = "1.500";

  it("keeps prefix indexes and maps the number to the single slot", () => {
    expect(counterTemplateRange(counter, number, { start: 0, end: 2 })).toEqual({ start: 0, end: 2 });
    expect(counterTemplateRange(counter, number, { start: 4, end: 6 })).toEqual({ start: 3, end: 4 });
    expect(counterTemplateRange(counter, number, { start: 1, end: 5 })).toEqual({ start: 1, end: 4 });
  });

  it("shifts suffix indexes past the slot", () => {
    expect(counterTemplateRange(counter, number, { start: 9, end: 12 })).toEqual({ start: 5, end: 8 });
    expect(counterTemplateRange(counter, number, { start: 0, end: 12 })).toEqual({ start: 0, end: 8 });
  });

  it("maps a caret inside the number to just after the slot", () => {
    expect(counterTemplateRange(counter, number, { start: 5, end: 5 })).toEqual({ start: 4, end: 4 });
    expect(counterTemplateRange(counter, number, { start: 3, end: 3 })).toEqual({ start: 3, end: 3 });
  });
});

describe("sameRuns", () => {
  it("compares runs by range and style", () => {
    expect(sameRuns(undefined, [])).toBe(true);
    expect(sameRuns([{ start: 0, end: 2, fill: "#FF0000" }], [{ fill: "#ff0000", end: 2, start: 0 }])).toBe(true);
    expect(sameRuns([{ start: 0, end: 2, fill: "#ff0000" }], [{ start: 0, end: 3, fill: "#ff0000" }])).toBe(false);
    expect(sameRuns([{ start: 0, end: 2, italic: true }], undefined)).toBe(false);
  });
});
