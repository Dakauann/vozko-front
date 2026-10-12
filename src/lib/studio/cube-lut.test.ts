import { describe, expect, it } from "vitest";

import { applyLutPixels, applyLutWarningPixels, cubeText, isCubeName, lutAtlas, lutMixPixel, lutPixel, lutRefIssue, lutWarningWeight, LUT_WARNING, parseCube, type Triple } from "./cube-lut";

const identity = (r: number, g: number, b: number): Triple => [r, g, b];
const warm = (r: number, g: number, b: number): Triple => [Math.min(1, r * 1.1 + 0.02), g, b * 0.8];

function parsed(text: string) {
  const result = parseCube(text);
  if (!result.ok) throw new Error(result.fault);
  return result.lut;
}

describe("cube LUTs", () => {
  it("reads the size, domain, title and the table with red changing fastest", () => {
    const lut = parsed(`# comment\nTITLE "Quente"\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\nLUT_3D_SIZE 2\n${["0 0 0", "1 0 0", "0 1 0", "1 1 0", "0 0 1", "1 0 1", "0 1 1", "1 1 1"].join("\n")}\n`);
    expect(lut.size).toBe(2);
    expect(lut.title).toBe("Quente");
    expect(Array.from(lut.table.slice(3, 6))).toEqual([1, 0, 0]);
    expect(Array.from(lut.table.slice(12, 15))).toEqual([0, 0, 1]);
  });

  it("refuses 1D tables, wrong row counts, unknown keywords and bad domains", () => {
    expect(parseCube("")).toEqual({ ok: false, fault: "empty" });
    expect(parseCube("LUT_1D_SIZE 4\n0 0 0")).toEqual({ ok: false, fault: "oneDimensional" });
    expect(parseCube("LUT_3D_SIZE 66")).toEqual({ ok: false, fault: "size" });
    expect(parseCube("LUT_3D_SIZE 2\n0 0 0")).toEqual({ ok: false, fault: "rows" });
    expect(parseCube("LUT_3D_SIZE 2\n0 0 x")).toEqual({ ok: false, fault: "number" });
    expect(parseCube("LUT_SHAPE warm\nLUT_3D_SIZE 2")).toEqual({ ok: false, fault: "keyword" });
    expect(parseCube(`DOMAIN_MIN 0 1 0\n${cubeText(2, identity)}`)).toEqual({ ok: false, fault: "domain" });
    expect(parseCube(`${cubeText(2, identity)}TITLE "late"\n`)).toEqual({ ok: false, fault: "keyword" });
  });

  it("is the identity for an identity table and interpolates between lattice points", () => {
    const atlas = lutAtlas(parsed(cubeText(17, identity)));
    expect(atlas.columns).toBe(5);
    expect(atlas.width).toBe(85);
    const out = lutPixel([0.31, 0.62, 0.93], atlas);
    out.forEach((v, c) => expect(v).toBeCloseTo([0.31, 0.62, 0.93][c], 2));
  });

  it("maps through the domain and mixes with the intensity, the same on image data", () => {
    const atlas = lutAtlas(parsed(cubeText(9, warm)));
    const full = lutPixel([0.5, 0.5, 0.5], atlas);
    expect(full[0]).toBeCloseTo(0.57, 2);
    expect(full[2]).toBeCloseTo(0.4, 2);
    const half = lutMixPixel([0.5, 0.5, 0.5], atlas, 0.5);
    expect(half[2]).toBeCloseTo(0.45, 2);
    const data = new Uint8ClampedArray([128, 64, 200, 255, 9, 9, 9, 0]);
    applyLutPixels(data, atlas, 0.75);
    expect(Array.from(data.slice(0, 3))).toEqual(lutMixPixel([128 / 255, 64 / 255, 200 / 255], atlas, 0.75).map((v) => Math.round(v * 255)));
    expect(Array.from(data.slice(4))).toEqual([9, 9, 9, 0]);
  });

  it("checks the library reference and the file name", () => {
    expect(lutRefIssue({ assetId: "" })).toBe("required");
    expect(lutRefIssue({ assetId: "look", intensity: 1.2 })).toBe("out_of_range");
    expect(lutRefIssue({ assetId: "look" })).toBeNull();
    expect(isCubeName("Teal.CUBE")).toBe(true);
    expect(isCubeName("look.3dl")).toBe(false);
  });
});

describe("missing LUT warning", () => {
  it("paints diagonal bands so a picture without its LUT never looks finished, leaving clear pixels clear", () => {
    expect(lutWarningWeight(0, 0)).toBe(LUT_WARNING.strength);
    expect(lutWarningWeight(LUT_WARNING.bandPx, 0)).toBe(0);
    expect(lutWarningWeight(LUT_WARNING.bandPx, LUT_WARNING.bandPx)).toBe(LUT_WARNING.strength);
    const data = new Uint8ClampedArray([100, 100, 100, 255, 0, 0, 0, 0]);
    applyLutWarningPixels(data, 2);
    expect(Array.from(data.slice(0, 4))).toEqual([Math.round(100 + (255 - 100) * 0.6), 40, Math.round(100 + (204 - 100) * 0.6), 255]);
    expect(Array.from(data.slice(4))).toEqual([0, 0, 0, 0]);
  });
});
