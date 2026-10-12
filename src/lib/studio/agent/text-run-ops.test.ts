import { describe, expect, it } from "vitest";

import { newTextLayer, type Layer } from "../document";
import { RUN_CLEAR_FIELDS, runsOutline, styledText } from "./text-run-ops";

function layer(text: string, extra: Partial<Layer> = {}): Layer {
  return { ...newTextLayer(text), fill: "#ffffff", fontWeight: 400, ...extra };
}

describe("style_text", () => {
  it("styles a range by index", () => {
    const result = styledText(layer("Compre agora"), "Compre agora", { char_start: 7, char_end: 12, fill: "#ffcc00", font_weight: 800 });
    expect(result).toEqual({ ok: true, value: { patch: { runs: [{ start: 7, end: 12, fill: "#ffcc00", fontWeight: 800 }] }, ranges: [{ start: 7, end: 12 }] } });
  });

  it("styles the first match or every match", () => {
    const first = styledText(layer("sale sale"), "sale sale", { match: "SALE", caps: true });
    expect(first.ok && first.value.patch.runs).toEqual([{ start: 0, end: 4, caps: true }]);
    const all = styledText(layer("sale sale"), "sale sale", { match: "sale", match_all: true, underline: true });
    expect(all.ok && all.value.patch.runs).toEqual([
      { start: 0, end: 4, underline: true },
      { start: 5, end: 9, underline: true },
    ]);
  });

  it("writes the layer when no range is given", () => {
    const styled = layer("abc", { runs: [{ start: 0, end: 1, fontWeight: 900 }] });
    const result = styledText(styled, "abc", { font_weight: 300 });
    expect(result.ok && result.value.patch).toEqual({ fontWeight: 300, runs: undefined });
  });

  it("brings fields back to the layer value with run_clear", () => {
    const styled = layer("abc", { runs: [{ start: 0, end: 3, fontWeight: 900, fill: "#ff0000" }] });
    const result = styledText(styled, "abc", { char_start: 0, char_end: 2, run_clear: ["font_weight"] });
    expect(result.ok && result.value.patch.runs).toEqual([
      { start: 0, end: 2, fill: "#ff0000" },
      { start: 2, end: 3, fontWeight: 900, fill: "#ff0000" },
    ]);
  });

  it("refuses ranges outside the text, missing matches, bad values and empty styles", () => {
    const plain = layer("abc");
    const reason = (op: Parameters<typeof styledText>[2]) => {
      const result = styledText(plain, "abc", op);
      return result.ok ? null : result.reason;
    };
    expect(reason({ char_start: 1, char_end: 9, caps: true })).toContain("de 0 a 3");
    expect(reason({ char_start: 2, char_end: 2, caps: true })).toContain("char_end");
    expect(reason({ match: "zz", caps: true })).toContain("não aparece");
    expect(reason({ match: "a", char_start: 0, caps: true })).toContain("não os dois");
    expect(reason({ fill: "red" })).toContain("fill");
    expect(reason({ font_id: "comic" })).toContain("comic");
    expect(reason({ font_weight: 450 })).toContain("font_weight");
    expect(reason({ font_size: 2 })).toContain("font_size");
    expect(reason({ letter_spacing: 5 })).toContain("letter_spacing");
    expect(reason({ run_clear: ["shadow"] })).toContain("run_clear");
    expect(reason({ char_start: 0, char_end: 1 })).toContain("ao menos um estilo");
  });

  it("lists the styled parts with their text for the outline", () => {
    const styled = layer("Compre agora", { runs: [{ start: 7, end: 12, fill: "#ffcc00", italic: false, letterSpacing: 0.1 }] });
    expect(runsOutline(styled, "Compre agora")).toEqual([{ start: 7, end: 12, text: "agora", fill: "#ffcc00", italic: false, letter_spacing: 0.1 }]);
    expect(runsOutline(layer("abc"), "abc")).toBeUndefined();
    expect(RUN_CLEAR_FIELDS).toEqual(["fill", "font_id", "font_weight", "font_size", "italic", "underline", "caps", "letter_spacing"]);
  });
});
