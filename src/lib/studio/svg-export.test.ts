import { describe, expect, it } from "vitest";

import { emptyArtboard, newShapeLayer, newTextLayer, type ImageSurface, type Layer } from "./document";
import { layersToSvg } from "./svg-export";
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
    expect(svg).toContain('opacity="0.5"');
  });

  it("round trips through the importer, basic shapes included", () => {
    const layers = [{ ...newShapeLayer("ellipse"), id: "e", fill: "#00ff00" }, { ...newShapeLayer("star"), id: "s" }];
    const svg = layersToSvg(doc(layers), ["e", "s"])!;
    const back = importSvg(svg, canvas);
    expect(back.ok && back.value.layers.map((l) => l.fill)).toEqual(["#00ff00", layers[1].fill]);
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
    expect(svg).toContain('<g opacity="0.5"><path d="M400 250 L600 250" fill="none" stroke="#111111"');
    expect(svg).toContain('<path d="M600 256 L612 250 L600 244 Z" fill="#111111"/></g>');
    expect(svg).toContain('viewBox="400 244 212 12"');
  });
});
