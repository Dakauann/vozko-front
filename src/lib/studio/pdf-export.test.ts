import { describe, expect, it } from "vitest";

import { emptyArtboard, newImageLayer, newShapeLayer, type Artboard, type Layer } from "./document";
import { exportScene, type ExportScene, type RasterItem } from "./export-scene";
import { pdfDate, rgbAndAlpha, writePdf, type PdfPage } from "./pdf-export";

const canvas = { width: 1000, height: 500 };

function board(layers: Layer[], background = "#ffffff"): Artboard {
  return { ...emptyArtboard(canvas, background), layers };
}

function text(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
}

function page(scene: ExportScene, images: PdfPage["images"] = new Map()): PdfPage {
  return { scene, images };
}

function objectsOf(pdf: string): Map<number, string> {
  const objects = new Map<number, string>();
  for (const match of pdf.matchAll(/(\d+) 0 obj\n([\s\S]*?)\nendobj/g)) objects.set(Number(match[1]), match[2]);
  return objects;
}

describe("pdf writer", () => {
  it("writes a valid file whose cross reference points at every object", () => {
    const bytes = writePdf({ title: "Promoção", created: new Date(Date.UTC(2026, 9, 9, 12, 0, 0)), pages: [page(exportScene(board([]), { transparent: true }))] });
    const pdf = text(bytes);
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    const startxref = Number(/startxref\n(\d+)\n/.exec(pdf)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
    const entries = pdf.slice(startxref).split("\n").slice(3).filter((line) => / n $/.test(line));
    entries.forEach((line, index) => expect(pdf.slice(Number(line.slice(0, 10)), Number(line.slice(0, 10)) + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`));
    expect(pdf).toContain("/Title <FEFF00500072006F006D006F00E700E3006F>");
    expect(pdf).toContain("/CreationDate (D:20261009120000Z)");
    expect(pdf).toContain("/MediaBox [0 0 750 375]");
  });

  it("puts each artboard on its own page with its own size", () => {
    const tall = { ...board([]), canvas: { width: 1080, height: 1920, background: "#000000" } };
    const pdf = text(writePdf({ title: "Dois", created: new Date(0), pages: [page(exportScene(board([]), { transparent: true })), page(exportScene(tall, { transparent: true }))] }));
    expect(pdf).toContain("/Count 2");
    expect(pdf).toContain("/MediaBox [0 0 750 375]");
    expect(pdf).toContain("/MediaBox [0 0 810 1440]");
  });

  it("draws vectors in pixels flipped onto the page, with blend and opacity as graphics states", () => {
    const rect = { ...newShapeLayer("rect", { x: 0.5, y: 0.5, w: 0.2, h: 0.4, rotation: 0, opacity: 1 }), id: "r", fill: "#ff000080", stroke: "#0000ff", strokeWidth: 4, dashArray: [2, 1], blendMode: "multiply" as const };
    const pdf = text(writePdf({ title: "V", created: new Date(0), pages: [page(exportScene(board([rect]), { transparent: true }))] }));
    expect(pdf).toContain("0.75 0 0 -0.75 0 375 cm");
    expect(pdf).toContain("400 150 m");
    expect(pdf).toContain("1 0 0 rg");
    expect(pdf).toContain("0 0 1 RG");
    expect(pdf).toContain("4 w");
    expect(pdf).toContain("[8 4] 0 d");
    expect(pdf).toMatch(/\/ca 0\.502 \/CA 1 \/BM \/Multiply/);
    expect(pdf).toContain("B\n");
  });

  it("paints a gradient as a shading clipped to the shape, with a soft mask for see through stops", () => {
    const shaded = { ...newShapeLayer("rect"), id: "g", fill: undefined, gradient: { from: "#000000", via: "#ff0000", to: "#ffffff00", angle: 0 } };
    const pdf = text(writePdf({ title: "G", created: new Date(0), pages: [page(exportScene(board([shaded]), { transparent: true }))] }));
    expect(pdf).toContain("/ShadingType 2");
    expect(pdf).toContain("/FunctionType 3");
    expect(pdf).toContain("/Bounds [0.5]");
    expect(pdf).toMatch(/W n\n[\s\S]*\/Sh\d+ sh/);
    expect(pdf).toContain("/S /Luminosity");
    expect(pdf).toContain("/ColorSpace /DeviceGray");
  });

  it("groups fill and stroke before fading a shape, as the canvas does", () => {
    const faded = { ...newShapeLayer("rect"), id: "f", fill: "#ff0000", stroke: "#000000", strokeWidth: 2, transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 0.5 } };
    const pdf = text(writePdf({ title: "F", created: new Date(0), pages: [page(exportScene(board([faded]), { transparent: true }))] }));
    expect(pdf).toContain("/Subtype /Form");
    expect(pdf).toContain("/Group << /S /Transparency >>");
    expect(pdf).toMatch(/\/ca 0\.5 \/CA 0\.5/);
    expect(pdf).toMatch(/\/Fm\d+ Do/);
  });

  it("places raster patches as images, jpeg as it is and pixels with their alpha", () => {
    const layers = [{ ...newImageLayer("a"), id: "photo" }, { ...newImageLayer("b"), id: "logo", blendMode: "screen" as const }];
    const scene = exportScene(board(layers), { transparent: true });
    const [first, second] = scene.items as RasterItem[];
    const images: PdfPage["images"] = new Map([
      [first.id, { bounds: { x: 10, y: 20, width: 100, height: 50 }, image: { kind: "jpeg" as const, width: 200, height: 100, data: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) } }],
      [second.id, { bounds: { x: 0, y: 0, width: 10, height: 10 }, image: { kind: "flate" as const, width: 2, height: 2, rgb: new Uint8Array([1, 2, 3]), alpha: new Uint8Array([4, 5]) } }],
    ]);
    const pdf = text(writePdf({ title: "I", created: new Date(0), pages: [page(scene, images)] }));
    expect(pdf).toContain("/Filter /DCTDecode");
    expect(pdf).toContain("/Filter /FlateDecode");
    expect(pdf).toMatch(/\/SMask \d+ 0 R/);
    expect(pdf).toContain("100 0 0 -50 10 70 cm");
    expect(pdf).toMatch(/\/BM \/Screen/);
    const objects = objectsOf(pdf);
    expect([...objects.values()].some((body) => body.includes("/Subtype /Image") && body.includes("\xff\xd8\xff\xd9"))).toBe(true);
  });

  it("refuses to write a page whose patch pixels are missing", () => {
    const scene = exportScene(board([{ ...newImageLayer("a"), id: "photo" }]), { transparent: true });
    expect(() => writePdf({ title: "X", created: new Date(0), pages: [page(scene)] })).toThrow();
  });

  it("splits canvas pixels into colour and alpha planes", () => {
    expect(rgbAndAlpha(new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]))).toEqual({ rgb: new Uint8Array([1, 2, 3, 5, 6, 7]), alpha: new Uint8Array([4, 8]) });
  });

  it("formats the creation date the way pdf readers expect", () => {
    expect(pdfDate(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe("D:20260102030405Z");
  });
});
