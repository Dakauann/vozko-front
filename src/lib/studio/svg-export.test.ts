import { describe, expect, it } from "vitest";

import { emptyArtboard, newImageLayer, newShapeLayer, newTextLayer, type ImageSurface, type Layer } from "./document";
import { exportScene, type RasterItem } from "./export-scene";
import { layersToSvg, sceneToSvg } from "./svg-export";
import { importSvg } from "./svg-import";

const canvas = { width: 1000, height: 500 };

function doc(layers: Layer[]): ImageSurface {
  return { ...emptyArtboard(canvas), layers };
}

describe("layersToSvg", () => {
  it("writes the selected vector layers as standalone SVG in canvas pixels", () => {
    const ring: Layer = { id: "ring", type: "shape", shape: "path", path: "M0 0 L1 0 L1 1 L0 1 Z", fillRule: "evenodd", fill: "#ff000080", stroke: "#111111", strokeWidth: 4, transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.4, rotation: 0, opacity: 0.5 } };
    const svg = layersToSvg(doc([ring]), ["ring"])!;
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('viewBox="400 150 200 200"');
    expect(svg).toContain('d="M400 150 L600 150 L600 350 L400 350 Z"');
    expect(svg).toContain('fill="#ff0000" fill-opacity="0.502"');
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain('stroke="#111111" stroke-width="4"');
    expect(svg).toContain(' opacity="0.5"');
  });

  it("round trips through the importer, basic shapes and gradients included", () => {
    const layers = [{ ...newShapeLayer("ellipse"), id: "e", fill: "#00ff00" }, { ...newShapeLayer("star"), id: "s" }];
    const svg = layersToSvg(doc(layers), ["e", "s"])!;
    const back = importSvg(svg, canvas);
    expect(back.ok && back.value.layers.map((l) => l.fill)).toEqual(["#00ff00", layers[1].fill]);
    const shaded = { ...newShapeLayer("rect"), id: "g", fill: undefined, gradient: { from: "#000000", to: "#ffffff", angle: 90 } };
    const again = importSvg(layersToSvg(doc([shaded]), ["g"])!, canvas);
    expect(again.ok && again.value.layers[0].gradient).toMatchObject({ from: "#000000", to: "#ffffff", angle: 90 });
  });

  it("returns null when nothing selected is a vector", () => {
    expect(layersToSvg(doc([{ ...newTextLayer("Oi"), id: "t" }]), ["t"])).toBeNull();
  });
});

describe("stroke styles in svg", () => {
  it("writes caps, joins, miter and dashes, and reads them back", () => {
    const dashed: Layer = { id: "d", type: "shape", shape: "path", path: "M0 0 L1 1", stroke: "#111111", strokeWidth: 4, lineCap: "square", lineJoin: "miter", miterLimit: 6, dashArray: [3, 1], dashOffset: 0.5, transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.4, rotation: 0, opacity: 1 } };
    const svg = layersToSvg(doc([dashed]), ["d"])!;
    expect(svg).toContain('stroke-linecap="square" stroke-linejoin="miter" stroke-miterlimit="6" stroke-dasharray="12 4" stroke-dashoffset="2"');
    const back = importSvg(svg, canvas);
    expect(back.ok && back.value.layers[0]).toMatchObject({ lineCap: "square", lineJoin: "miter", miterLimit: 6, dashArray: [3, 1], dashOffset: 0.5 });
  });
});

describe("arrowheads in svg", () => {
  it("writes each arrowhead as a filled triangle in the stroke colour and keeps it inside the view box", () => {
    const arrow: Layer = { id: "a", type: "shape", shape: "path", path: "M0 0.5 L1 0.5", stroke: "#111111", strokeWidth: 4, arrowEnd: true, transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.4, rotation: 0, opacity: 0.5 } };
    const svg = layersToSvg(doc([arrow]), ["a"])!;
    expect(svg).toContain('<path d="M400 250 L600 250" fill="none" stroke="#111111"');
    expect(svg).toContain('<path d="M600 256 L612 250 L600 244 Z" fill="#111111" opacity="0.5"/>');
    expect(svg).toContain('viewBox="400 244 212 12"');
  });
});

describe("whole artboard svg", () => {
  const photo = { ...newImageLayer("asset", { x: 0.25, y: 0.5, w: 0.2, h: 0.4, rotation: 0, opacity: 1 }), id: "p", blendMode: "multiply" as const };
  const shape = { ...newShapeLayer("rect"), id: "s", fill: undefined, gradient: { from: "#000000", to: "#ffffff80", angle: 0 }, blendMode: "screen" as const };
  const surface: ImageSurface = { ...emptyArtboard(canvas, "#fafafa"), layers: [photo, shape] };

  it("writes the background, the vectors and the raster patches at the artboard size", () => {
    const scene = exportScene(surface, { transparent: true });
    const patch = scene.items[0] as RasterItem;
    const svg = sceneToSvg(scene, new Map([[patch.id, { bounds: { x: 150, y: 150, width: 200, height: 200 }, href: "data:image/png;base64,iVBORw0KGgo=" }]]));
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1000" height="500" viewBox="0 0 1000 500">')).toBe(true);
    expect(svg).toContain('<rect x="0" y="0" width="1000" height="500" fill="#fafafa"/>');
    expect(svg).toContain('<image x="150" y="150" width="200" height="200" preserveAspectRatio="none" xlink:href="data:image/png;base64,iVBORw0KGgo=" style="mix-blend-mode:multiply"/>');
    expect(svg).toMatch(/<linearGradient id="g0" gradientUnits="userSpaceOnUse" x1="[\d.]+" y1="[\d.]+" x2="[\d.]+" y2="[\d.]+"><stop offset="0" stop-color="#000000"\/><stop offset="1" stop-color="#ffffff" stop-opacity="0.502"\/><\/linearGradient>/);
    expect(svg).toContain('fill="url(#g0)"');
    expect(svg).toContain('style="mix-blend-mode:screen"');
    expect(svg.indexOf("<image")).toBeLessThan(svg.indexOf("<path"));
  });

  it("leaves a clear artboard clear and refuses to write a patch it was not given", () => {
    const clear = exportScene({ ...surface, canvas: { ...canvas, background: "" }, layers: [] }, { transparent: true });
    expect(sceneToSvg(clear, new Map())).not.toContain("<rect");
    expect(() => sceneToSvg(exportScene(surface, { transparent: true }), new Map())).toThrow();
  });
});
