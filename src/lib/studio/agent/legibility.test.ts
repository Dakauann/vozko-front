import { describe, expect, it } from "vitest";

import { emptyArtboard, newTextLayer, type Layer, type Transform } from "../document";
import { backdropContrast, legibilityReport, unitCorners, type PixelGrid } from "./legibility";

const box = (x: number, y: number, w: number, h: number): Transform => ({ x, y, w, h, rotation: 0, opacity: 1 });

function grid(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): PixelGrid {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

const white = { r: 255, g: 255, b: 255, a: 1 };
const halfLight = grid(100, 100, (x) => (x < 50 ? [20, 20, 20] : [235, 235, 235]));
const unitCanvas = { width: 100, height: 100 };
const middleBand = unitCorners(box(0.5, 0.5, 0.8, 0.2), unitCanvas);

function title(text: string, fill: string, extra: Partial<Layer> = {}): Layer {
  return { ...newTextLayer(text), id: "t1", fill, fontSize: 0.03, transform: box(0.5, 0.5, 0.8, 0.2), ...extra };
}

describe("legibility measured on the pixels behind the text", () => {
  it("reports the worst tenth of the backdrop and the typical contrast", () => {
    const measured = backdropContrast(halfLight, middleBand, white, null);
    expect(measured).not.toBeNull();
    expect(measured!.low).toBeLessThan(1.3);
    expect(measured!.typical).toBeGreaterThan(10);
  });

  it("counts a thick outline when it reads better than the fill", () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const measured = backdropContrast(halfLight, middleBand, white, black);
    expect(measured!.low).toBeGreaterThan(10);
  });

  it("has nothing to say about a box outside the picture", () => {
    expect(backdropContrast(halfLight, unitCorners(box(1.3, 0.5, 0.2, 0.2), unitCanvas), white, null)).toBeNull();
  });

  it("flags white text that sits half over a light area of a photo", () => {
    const doc = emptyArtboard({ width: 1000, height: 1000 });
    doc.layers = [title("Oferta de verão", "#ffffff")];
    const [line] = legibilityReport(doc, halfLight);
    expect(line).toMatch(/^aviso: o texto t1/);
    expect(line).toContain("precisa de 4.5:1");
  });

  it("calls it an error when even the typical point fails", () => {
    const doc = emptyArtboard({ width: 1000, height: 1000 });
    doc.layers = [title("Oferta de verão", "#ffffff")];
    const light = grid(100, 100, () => [240, 240, 240]);
    expect(legibilityReport(doc, light)[0]).toMatch(/^erro: /);
  });

  it("says all is well when every text reads, and skips texts that carry their own box", () => {
    const doc = emptyArtboard({ width: 1000, height: 1000 });
    const dark = grid(100, 100, () => [15, 15, 15]);
    doc.layers = [title("Oferta", "#ffffff"), { ...title("Cupom", "#ffffff"), id: "t2", highlight: { color: "#000000", radius: 0 } }];
    expect(legibilityReport(doc, dark)).toEqual(["ok: contraste medido nos pixels de 1 texto, todos acima do mínimo"]);
  });

  it("measures a text box that falls between the pixel centers of a coarse capture", () => {
    const doc = emptyArtboard({ width: 1000, height: 500 });
    doc.layers = [title("Oferta", "#ffffff", { fontSize: 0.05, transform: box(0.5, 0.5, 0.6, 0.2) })];
    expect(legibilityReport(doc, grid(4, 4, () => [245, 245, 245]))[0]).toMatch(/^erro: o texto t1 /);
  });

  describe("a text turned 30 degrees", () => {
    const TURN = 30;
    const radians = (TURN * Math.PI) / 180;
    const tilted = { ...box(0.5, 0.5, 0.6, 0.12), rotation: TURN };

    function insideTurned(x: number, y: number, halfW: number, halfH: number): boolean {
      const dx = x - 0.5;
      const dy = y - 0.5;
      const along = dx * Math.cos(radians) + dy * Math.sin(radians);
      const across = -dx * Math.sin(radians) + dy * Math.cos(radians);
      return Math.abs(along) <= halfW && Math.abs(across) <= halfH;
    }

    const SIDE = 200;
    const atCenter = (index: number) => (index + 0.5) / SIDE;

    it("reads only its own turned box, not the light corners of its upright bounds", () => {
      const ribbon = grid(SIDE, SIDE, (x, y) => (insideTurned(atCenter(x), atCenter(y), 0.34, 0.075) ? [17, 24, 39] : [240, 240, 240]));
      const doc = emptyArtboard({ width: 1000, height: 1000 });
      doc.layers = [title("ATÉ 50% OFF", "#ffffff", { transform: tilted })];
      expect(legibilityReport(doc, ribbon)).toEqual(["ok: contraste medido nos pixels de 1 texto, todos acima do mínimo"]);
    });

    it("still flags it when a light half of the background runs through its turned box", () => {
      const split = grid(SIDE, SIDE, (x) => (x < SIDE * 0.65 ? [17, 24, 39] : [240, 240, 240]));
      const doc = emptyArtboard({ width: 1000, height: 1000 });
      doc.layers = [title("ATÉ 50% OFF", "#ffffff", { transform: tilted })];
      expect(legibilityReport(doc, split)[0]).toMatch(/^aviso: o texto t1/);
    });
  });

  it("notes that a text shadow is left out of the measure", () => {
    const doc = emptyArtboard({ width: 1000, height: 1000 });
    doc.layers = [title("Oferta", "#ffffff", { shadow: { x: 0, y: 2, blur: 8, color: "#00000080" } })];
    expect(legibilityReport(doc, grid(100, 100, () => [240, 240, 240]))[0]).toContain("a sombra do texto não entra na medida");
  });
});
